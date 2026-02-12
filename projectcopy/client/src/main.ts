import './styles/main.css'
import './styles/layout.css'
import { supabase } from './lib/supabase'
import { createIcons, Settings, LogOut, Send, MessageSquare, Users, Sparkles, Volume2, Check, CheckCheck, ArrowLeft } from 'lucide'

// Initial UI Setup
createIcons({
  icons: { Settings, LogOut, Send, MessageSquare, Users, Sparkles, Volume2, Check, CheckCheck, ArrowLeft }
})


let authSection: HTMLElement, mainSection: HTMLElement, loginForm: HTMLFormElement
let logoutBtn: HTMLElement, settingsBtn: HTMLElement, settingsModal: HTMLElement
let closeSettingsBtn: HTMLElement, settingsForm: HTMLFormElement
let messageInput: HTMLInputElement, chatForm: HTMLFormElement
let backToSidebarBtn: HTMLElement
let currentRealtimeChannel: any = null

function initElements() {
  authSection = document.getElementById('auth-section')!
  mainSection = document.getElementById('main-section')!
  loginForm = document.getElementById('login-form') as HTMLFormElement
  logoutBtn = document.getElementById('logout-btn')!
  settingsBtn = document.getElementById('settings-btn')!
  settingsModal = document.getElementById('settings-modal')!
  closeSettingsBtn = document.getElementById('close-settings')!
  settingsForm = document.getElementById('settings-form') as HTMLFormElement
  messageInput = document.getElementById('message-input') as HTMLInputElement
  chatForm = document.getElementById('chat-form') as HTMLFormElement
  backToSidebarBtn = document.getElementById('back-to-sidebar')!

  if (!settingsForm) console.error('Settings form not found in DOM')

  // Create a visible debug bar
  const debugBar = document.createElement('div')
  debugBar.id = 'debug-bar'
  const isMobile = window.innerWidth < 768
  debugBar.style.cssText = `position:fixed; ${isMobile ? 'bottom:10px' : 'top:10px'}; right:10px; background:rgba(30, 41, 59, 0.9); backdrop-filter:blur(8px); color:white; font-size:10px; padding:6px 12px; z-index:9999; border-radius:30px; border:1px solid rgba(255,255,255,0.1); box-shadow:0 4px 6px rgba(0,0,0,0.3); pointer-events:none; transition: opacity 0.3s;`
  debugBar.innerHTML = '<span style="opacity:0.6">UniqueChat AI</span> <span style="margin:0 8px">|</span> <span id="debug-text">Initializing...</span>'
  document.body.appendChild(debugBar)
}

function updateDebugStatus(msg: string) {
  const text = document.getElementById('debug-text')
  if (text) text.innerHTML = msg
}

let activeChatId: string | null = null
let aiChatHistory: any[] = []
let friendStatusCache: { [key: string]: string } = {}

// Text to Speech Function (Uses Browser Native TTS for Realistic Feel)
async function speak(text: string) {
  if (!text) return;

  if (!('speechSynthesis' in window)) {
    console.error('Browser does not support TTS');
    return;
  }

  updateDebugStatus('AI is speaking...');
  window.speechSynthesis.cancel(); // Stop any pending speech

  const utterance = new SpeechSynthesisUtterance(text);

  // Detection for Tamil content (Script or common patterns)
  const hasTamilScript = /[\u0B80-\u0BFF]/.test(text);
  // Simple heuristic for Thanglish (common words/patterns)
  const commonThanglish = /\b(epdi|iruka|va|po|yen|ena|pandra|nanba|thambi)\b/i.test(text);
  const isTamilContext = hasTamilScript || commonThanglish;

  // Get available voices
  let voices = window.speechSynthesis.getVoices();

  // If voices aren't loaded yet, wait a bit (some browsers load them async)
  if (voices.length === 0) {
    await new Promise(resolve => {
      window.speechSynthesis.onvoiceschanged = () => {
        voices = window.speechSynthesis.getVoices();
        resolve(null);
      };
    });
  }

  let selectedVoice = null;

  if (isTamilContext) {
    // Priority: Premium Google/Microsoft Tamil voices -> Regular Tamil -> Premium English
    selectedVoice = voices.find(v => v.lang.includes('ta-IN') && (v.name.includes('Google') || v.name.includes('Microsoft') || v.name.includes('Natural'))) ||
      voices.find(v => v.lang.includes('ta-IN')) ||
      voices.find(v => v.name.includes('Tamil')) ||
      voices.find(v => v.name.includes('Google US English')); // Fallback to clear English

    utterance.lang = hasTamilScript ? 'ta-IN' : 'en-IN'; // en-IN often handles Thanglish better
    utterance.rate = 1.0;
    utterance.pitch = 1.1; // Slightly friendly pitch
  } else {
    // English focus
    selectedVoice = voices.find(v => v.name.includes('Google US English')) ||
      voices.find(v => v.name.includes('Natural')) ||
      voices.find(v => v.lang.startsWith('en') && v.name.includes('Google')) ||
      voices.find(v => v.lang.includes('en-US')) ||
      voices.find(v => v.lang.startsWith('en'));

    utterance.lang = 'en-US';
    utterance.rate = 0.95; // Slightly slower for more "human" feel
    utterance.pitch = 1.0;
  }

  if (selectedVoice) {
    utterance.voice = selectedVoice;
    console.log('Selected Voice:', selectedVoice.name);
  }

  utterance.onend = () => {
    updateDebugStatus('Online');
  };

  utterance.onerror = (err) => {
    console.error('TTS Error:', err);
    updateDebugStatus('Online');
  };

  window.speechSynthesis.speak(utterance);
}


// Auth State Listener
supabase.auth.onAuthStateChange(async (event, session) => {
  console.log('Auth event:', event, session?.user?.id)
  updateDebugStatus(`Status: ${event}`)
  handleAuthState(session)
})

async function handleAuthState(session: any) {
  if (session) {
    showMainApp()
    await handleUserSetup(session.user)
    fetchUserProfile(session.user.id)
    renderSidebarContent('chats')
    subscribeToFriends(session.user.id)
  } else {
    showAuth()
  }
}


function showMainApp() {
  authSection.classList.add('hidden')
  mainSection.classList.remove('hidden')
  // On mobile, show sidebar and hide chat area initially if no chat selected
  if (window.innerWidth < 768) {
    document.querySelector('.sidebar')?.classList.remove('mobile-hidden')
    document.querySelector('.chat-area')?.classList.add('mobile-hidden')
  }
}

function showAuth() {
  authSection.classList.remove('hidden')
  mainSection.classList.add('hidden')
}

// Mobile View Toggles
function showMobileChat() {
  if (window.innerWidth < 768) {
    document.querySelector('.sidebar')?.classList.add('mobile-hidden')
    document.querySelector('.chat-area')?.classList.remove('mobile-hidden')
  }
}

function showMobileSidebar() {
  if (window.innerWidth < 768) {
    document.querySelector('.sidebar')?.classList.remove('mobile-hidden')
    document.querySelector('.chat-area')?.classList.add('mobile-hidden')
  }
}

async function handleUserSetup(user: any) {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') {
      console.error('Supabase error fetching profile:', error)
      return
    }

    if (!profile) {
      updateDebugStatus('Creating Account...')
      const username = `user_${Math.random().toString(36).substring(2, 9)}`
      const { error: insertError } = await supabase.from('profiles').insert([
        {
          id: user.id,
          username,
          display_name: user.user_metadata.full_name || user.email?.split('@')[0] || 'New User',
          avatar_url: user.user_metadata.avatar_url || null,
          status: 'online',
          last_seen: new Date().toISOString()
        }
      ])
      if (insertError) {
        console.error('Error inserting profile:', insertError)
        alert('Failed to initialize profile. Please check RLS policies.')
      }
    } else {
      // Fix missing username for old profiles
      if (!profile.username) {
        const username = `user_${Math.random().toString(36).substring(2, 9)}`
        await supabase.from('profiles').update({ username }).eq('id', user.id)
      }
      // Ensure online status on login
      await supabase.from('profiles').update({ status: 'online', last_seen: new Date().toISOString() }).eq('id', user.id)
    }
  } catch (err) {
    console.error('Unexpected error in handleUserSetup:', err)
  }
}

// Helper: Generate a unique gradient background for avatars
function getAvatarGradient(seed: string) {
  const hash = Array.from(seed).reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0)
  const h1 = Math.abs(hash % 360)
  const h2 = (h1 + 40) % 360
  return `linear-gradient(135deg, hsl(${h1}, 70%, 60%), hsl(${h2}, 80%, 40%))`
}

function fetchUserProfile(userId: string) {
  supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
    .then(({ data: profile }) => {
      if (profile) {
        const userNameEl = document.getElementById('user-name')!
        const userHandleEl = document.getElementById('user-handle')!
        const userAvatarEl = document.getElementById('user-avatar')!

        userNameEl.textContent = profile.display_name || 'Anonymous'
        userHandleEl.textContent = `@${profile.username}`
        if (profile.avatar_url) {
          userAvatarEl.innerHTML = `<img src="${profile.avatar_url}" style="width: 100%; height: 100%; object-fit: cover;">`
        } else {
          userAvatarEl.style.background = getAvatarGradient(profile.username)
          userAvatarEl.innerHTML = `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:white; font-weight:bold; font-size: 1.1rem; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">${(profile.display_name || 'A').charAt(0).toUpperCase()}</div>`
        }
      }
    })
}

// Navigation
function setupNavigation() {
  const tabs = document.querySelectorAll('.tab')
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'))
      tab.classList.add('active')
      const view = tab.id.replace('tab-', '')
      renderSidebarContent(view)
    })
  })
}

function renderSidebarContent(view: string) {
  const contentEl = document.getElementById('sidebar-content')!
  contentEl.innerHTML = `<div style="padding: 2rem; color: var(--text-muted); text-align:center;">
    <div class="loader" style="margin-bottom:1rem;"></div>
    Loading ${view}...
  </div>`

  if (view === 'ai') {
    contentEl.innerHTML = `
      <div style="padding: 1.5rem;">
        <h3 style="margin-bottom: 0.5rem; font-size: 1.1rem;">AI Assistant</h3>
        <p style="font-size: 0.8125rem; color: var(--text-muted); margin-bottom: 1.5rem;">
          Powered by Gemini 1.5 Flash. I can help with code, creative writing, or just chat.
        </p>
        <div style="background: rgba(255,255,255,0.03); padding: 1.25rem; border-radius: var(--radius); border: 1px solid var(--border); font-size: 0.8125rem;">
          <strong style="color: var(--primary); display: block; margin-bottom: 0.5rem;">Capabilities</strong>
          <ul style="margin-top: 0.5rem; padding-left: 1.25rem; line-height: 1.6; color: var(--text-muted);">
            <li>Debugging & Code reviews</li>
            <li>Study summaries</li>
            <li>Creative brainstorming</li>
          </ul>
        </div>
      </div>
    `
    setupAIChat()
  } else if (view === 'friends') {
    contentEl.innerHTML = `
      <div style="padding: 1.5rem;">
        <div class="input-group" style="margin-bottom: 1.5rem;">
          <input type="text" id="search-users" placeholder="Search @username...">
        </div>
        <div id="search-results"></div>
        <div style="margin: 2rem 0 1rem; display: flex; align-items: center; gap: 0.75rem;">
          <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.05em;">Friend Requests</span>
          <div style="flex:1; height:1px; background:var(--border);"></div>
        </div>
        <div id="friend-requests-list"></div>
      </div>
    `
    setupFriendsSearch()
    loadFriendRequests()
  } else if (view === 'chats') {
    contentEl.innerHTML = `
      <div style="padding: 1rem 0;">
        <div id="recent-chats-list"></div>
      </div>
    `
    loadRecentChats()
  }

  createIcons({
    icons: { Settings, LogOut, Send, MessageSquare, Users, Sparkles }
  })
}

async function setupFriendsSearch() {
  const searchInput = document.getElementById('search-users') as HTMLInputElement
  const resultsEl = document.getElementById('search-results')!

  searchInput.addEventListener('input', async () => {
    const query = searchInput.value.trim().replace('@', '')
    if (query.length < 2) {
      resultsEl.innerHTML = ''
      return
    }

    const { data: users } = await supabase
      .from('profiles')
      .select('*')
      .ilike('username', `%${query}%`)
      .limit(5)

    if (users) {
      resultsEl.innerHTML = users.map(user => `
        <div class="user-item" style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem; border-radius:12px; transition: background 0.2s; margin-bottom: 4px;">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <div style="width: 36px; height: 36px; border-radius: 50%; background: ${user.avatar_url ? 'transparent' : getAvatarGradient(user.id)}; overflow: hidden; display: flex; align-items: center; justify-content: center;">
              ${user.avatar_url ? `<img src="${user.avatar_url}" style="width:100%; height:100%; object-fit:cover;">` : `<span style="color:white; font-weight:bold; font-size: 0.8rem;">${(user.display_name || 'U').charAt(0).toUpperCase()}</span>`}
            </div>
            <div style="font-size: 0.8125rem;">
              <div style="font-weight: 600;">${user.display_name}</div>
              <div style="color: var(--text-muted); font-size: 0.75rem;">@${user.username}</div>
            </div>
          </div>
          <button class="btn btn-primary add-friend-btn" data-user-id="${user.id}" style="padding: 0.4rem 0.8rem; font-size: 0.75rem; border-radius:30px;">Add</button>
        </div>
      `).join('')

      document.querySelectorAll('.add-friend-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const targetUserId = (e.currentTarget as HTMLButtonElement).dataset.userId
            ; (e.currentTarget as HTMLButtonElement).disabled = true
            ; (e.currentTarget as HTMLButtonElement).textContent = 'Sending...'
          await sendFriendRequest(targetUserId!)
            ; (e.currentTarget as HTMLButtonElement).textContent = 'Sent!'
        })
      })
    }
  })
}

async function sendFriendRequest(targetUserId: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { error } = await supabase.from('friend_requests').insert([
    { sender_id: user.id, receiver_id: targetUserId, status: 'pending' }
  ])
  if (error) {
    if (error.code === '23505') alert('Request already sent!')
    else alert('Error: ' + error.message)
  }
}

async function loadFriendRequests() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: requests } = await supabase
    .from('friend_requests')
    .select('*, profiles:sender_id(*)')
    .eq('receiver_id', user.id)
    .eq('status', 'pending')

  const listEl = document.getElementById('friend-requests-list')!
  if (!requests || requests.length === 0) {
    listEl.innerHTML = '<p style="font-size: 0.8125rem; color: var(--text-muted); text-align:center; padding: 1rem;">No pending requests.</p>'
    return
  }

  listEl.innerHTML = (requests as any[]).map(req => `
    <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem; background: rgba(255,255,255,0.02); border-radius:12px; margin-bottom: 0.5rem; border: 1px solid var(--border);">
      <div style="display: flex; align-items: center; gap: 0.75rem;">
         <div style="width: 32px; height: 32px; border-radius: 50%; background: ${getAvatarGradient(req.profiles.id)}; overflow: hidden; font-size: 0.75rem; display:flex; align-items:center; justify-content:center; color:white; font-weight:bold;">
          ${(req.profiles.display_name?.[0] || 'U').toUpperCase()}
         </div>
         <span style="font-size: 0.8125rem; font-weight:600;">@${req.profiles.username}</span>
      </div>
      <div style="display: flex; gap: 0.5rem;">
        <button class="btn btn-primary accept-request" data-req-id="${req.id}" data-sender-id="${req.sender_id}" style="padding: 0.35rem 0.7rem; font-size: 0.7rem; border-radius:30px;">Accept</button>
        <button class="btn reject-request" data-req-id="${req.id}" style="padding: 0.35rem 0.7rem; font-size: 0.7rem; border: 1px solid var(--border); border-radius:30px;">✕</button>
      </div>
    </div>
  `).join('')

  document.querySelectorAll('.accept-request').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const { reqId, senderId } = (e.currentTarget as HTMLButtonElement).dataset
      acceptFriendRequest(reqId!, senderId!)
    })
  })

  document.querySelectorAll('.reject-request').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const { reqId } = (e.currentTarget as HTMLButtonElement).dataset
      await supabase.from('friend_requests').delete().eq('id', reqId)
      loadFriendRequests()
    })
  })
}

async function acceptFriendRequest(requestId: string, senderId: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  // Transaction-like approach (RLS will handle safety)
  // Delete the request first
  await supabase.from('friend_requests').delete().eq('id', requestId)

  // Insert only OUR side. The DB trigger will automatically insert the other side!
  const { error } = await supabase.from('friends').insert([
    { user_id: user.id, friend_id: senderId }
  ])

  if (error) {
    console.error('Error adding friend:', error)
    alert('Failed to add friend: ' + error.message)
    return
  }

  loadFriendRequests()
  updateDebugStatus('Friend added!')

  // Switch to chats view automatically
  setTimeout(() => {
    const chatTab = document.getElementById('tab-chats')
    if (chatTab) {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'))
      chatTab.classList.add('active')
      renderSidebarContent('chats')
    }
    updateDebugStatus('Online')
  }, 1000)
}

function setupAIChat() {
  activeChatId = null
  if (currentRealtimeChannel) {
    currentRealtimeChannel.unsubscribe()
    currentRealtimeChannel = null
  }

  const chatHeaderName = document.getElementById('active-chat-name')!
  const chatHeaderStatus = document.getElementById('active-chat-status')!
  chatHeaderName.textContent = 'UniqueChat AI'
  chatHeaderStatus.textContent = 'Online • Friendly'

  const messagesEl = document.getElementById('messages')!
  messagesEl.innerHTML = `
    <div class="empty-state" style="text-align: center; margin: auto; padding: 2rem; max-width: 300px; opacity: 0.6;">
      <div style="font-size: 2rem; margin-bottom: 1rem;">✨</div>
      <h3 style="margin-bottom: 0.5rem;">AI Chat Started</h3>
      <p style="font-size: 0.875rem;">Gemini stays in sync with your conversation history for better context.</p>
    </div>
  `
  showMobileChat()
}

async function loadRecentChats() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: friends } = await supabase
    .from('friends')
    .select('*, profiles:friend_id(*)')
    .eq('user_id', user.id)

  const listEl = document.getElementById('recent-chats-list')!
  if (!friends || friends.length === 0) {
    listEl.innerHTML = '<p style="font-size: 0.8125rem; color: var(--text-muted); text-align:center; padding: 2rem;">No chats yet.<br>Add some friends to start messaging!</p>'
    return
  }

  listEl.innerHTML = (friends as any[]).map(friend => {
    friendStatusCache[friend.friend_id] = friend.profiles.status || 'offline'
    return `
      <div class="chat-item ${activeChatId === friend.friend_id ? 'active' : ''}" data-friend-id="${friend.friend_id}" data-friend-name="${friend.profiles.display_name}">
        <div style="width: 44px; height: 44px; border-radius: 50%; background: ${friend.profiles.avatar_url ? 'transparent' : getAvatarGradient(friend.profiles.id)}; overflow: hidden; border: 2px solid transparent; display: flex; align-items: center; justify-content: center;">
          ${friend.profiles.avatar_url ? `<img src="${friend.profiles.avatar_url}" style="width:100%; height:100%; object-fit:cover;">` : `<span style="color:white; font-weight:bold; font-size: 1rem;">${(friend.profiles.display_name || 'U').charAt(0).toUpperCase()}</span>`}
        </div>
        <div style="flex: 1;">
          <div style="font-weight: 600; font-size: 0.875rem; color: var(--text-main);">${friend.profiles.display_name}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">@${friend.profiles.username}</div>
        </div>
        <div class="status-dot ${friend.profiles.status === 'online' ? 'status-online' : ''}"></div>
      </div>
    `
  }).join('')

  document.querySelectorAll('.chat-item').forEach(item => {
    item.addEventListener('click', (e) => {
      const { friendId, friendName } = (e.currentTarget as HTMLElement).dataset
      document.querySelectorAll('.chat-item').forEach(cl => cl.classList.remove('active'))
        ; (e.currentTarget as HTMLElement).classList.add('active')
      selectChat(friendId!, friendName!)
    })
  })
}

async function selectChat(friendId: string, friendName: string) {
  activeChatId = friendId
  const chatHeaderName = document.getElementById('active-chat-name')!
  const chatHeaderStatus = document.getElementById('active-chat-status')!
  chatHeaderName.textContent = friendName
  chatHeaderStatus.textContent = 'Connected'

  showMobileChat()

  const messagesEl = document.getElementById('messages')!
  messagesEl.innerHTML = ''

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .or(`and(sender_id.eq.${user.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${user.id})`)
    .order('created_at', { ascending: true })

  if (messages) {
    messages.forEach(msg => {
      appendMessage(msg.content, msg.sender_id === user.id ? 'sent' : 'received', msg.created_at, msg.is_seen)
    })
  }

  // Mark all unread messages as seen
  await supabase
    .from('messages')
    .update({ is_seen: true })
    .eq('receiver_id', user.id)
    .eq('sender_id', friendId)
    .eq('is_seen', false)

  subscribeToMessages(user.id, friendId)
}

function subscribeToFriends(userId: string) {
  // Real-time status updates for friends
  supabase
    .channel('public_profiles')
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'profiles'
    }, (payload) => {
      friendStatusCache[payload.new.id] = payload.new.status
      // Refresh sidebar if on chats tab to show online glow
      const activeTab = document.querySelector('.tab.active')?.id
      if (activeTab === 'tab-chats') {
        loadRecentChats()
      }
    })
    .subscribe()

  supabase
    .channel('friends_realtime')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'friends',
      filter: `user_id=eq.${userId}`
    }, () => {
      const activeTab = document.querySelector('.tab.active')?.id
      if (activeTab === 'tab-chats') {
        loadRecentChats()
      }
    })
    .subscribe()
}

function subscribeToMessages(userId: string, friendId: string) {
  if (currentRealtimeChannel) {
    currentRealtimeChannel.unsubscribe()
  }

  currentRealtimeChannel = supabase
    .channel('messages_realtime')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `receiver_id=eq.${userId}`
    }, (payload) => {
      if (payload.new.sender_id === friendId) {
        appendMessage(payload.new.content, 'received', payload.new.created_at)
        // Auto mark as seen since we are in the active chat
        supabase.from('messages').update({ is_seen: true }).eq('id', payload.new.id).then()
      }
    })
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'messages',
      filter: `sender_id=eq.${userId}`
    }, (payload) => {
      // If a message we sent was marked seen, update the UI
      if (payload.new.receiver_id === friendId && payload.new.is_seen) {
        // Find existing message element and update icon
        const messagesEl = document.getElementById('messages')!
        const lastMsg = Array.from(messagesEl.querySelectorAll('.message-sent')).pop()
        if (lastMsg) {
          const iconEl = lastMsg.querySelector('.status-icon')
          if (iconEl) {
            iconEl.innerHTML = `<i data-lucide="check-check" style="width:14px; color: #3b82f6;"></i>`
            createIcons({ icons: { CheckCheck } })
          }
        }
      }
    })
    .subscribe()
}

async function sendMessage(content: string, receiverId: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('messages').insert([{ sender_id: user.id, receiver_id: receiverId, content }])
}

async function handleChatSubmit(e: Event) {
  e.preventDefault()
  const content = messageInput.value.trim()
  if (!content) return
  messageInput.value = ''

  const activeTab = document.querySelector('.tab.active')?.id
  if (activeTab === 'tab-ai') {
    appendMessage(content, 'sent')
    // Show AI writing indicator
    const typingMsg = appendMessage('Gemini is thinking...', 'received')
    const aiResponse = await getAIResponse(content)
    typingMsg.querySelector('.message-content')!.innerHTML = aiResponse
    typingMsg.classList.remove('typing-state')

    // Safe Base64 encoding for the onclick text to handle quotes and newlines
    const safeText = btoa(unescape(encodeURIComponent(aiResponse)));
    const speakerHtml = `<button class="voice-btn" onclick="window.speak(decodeURIComponent(escape(atob('${safeText}'))))">
      <i data-lucide="volume-2" style="width:14px;height:14px;"></i>
    </button>`
    typingMsg.insertAdjacentHTML('beforeend', speakerHtml)
    createIcons({ icons: { Volume2 } })

  } else if (activeChatId) {
    appendMessage(content, 'sent')
    await sendMessage(content, activeChatId)
  }
}

async function getAIResponse(message: string) {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history: aiChatHistory })
    })

    if (!response.ok) {
      const errorData = await response.json()
      return `AI Error: ${errorData.error || 'Failed to get response'}`
    }

    const data = await response.json()
    aiChatHistory.push({ role: 'user', parts: [{ text: message }] })
    aiChatHistory.push({ role: 'model', parts: [{ text: data.text }] })
    return data.text
  } catch (error) {
    return 'I am having trouble connecting to the AI server. Is it running? (Check terminal output for errors)'
  }
}

function appendMessage(content: string, type: 'sent' | 'received', timestamp?: string, isSeen: boolean = false) {
  const messagesEl = document.getElementById('messages')!
  const emptyState = messagesEl.querySelector('.empty-state')
  if (emptyState) emptyState.remove()

  const msgEl = document.createElement('div')
  msgEl.className = `message message-${type} ${content === 'Gemini is thinking...' ? 'typing-state' : ''}`

  const time = timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  let statusIcon = ''
  if (type === 'sent') {
    const isOnline = activeChatId && friendStatusCache[activeChatId] === 'online'
    if (isSeen) {
      statusIcon = `<i data-lucide="check-check" style="width:14px; color: #3b82f6;"></i>` // Blue tick
    } else if (isOnline) {
      statusIcon = `<i data-lucide="check-check" style="width:14px; color: #94a3b8;"></i>` // Double grey tick
    } else {
      statusIcon = `<i data-lucide="check" style="width:14px; color: #94a3b8;"></i>` // Single tick
    }
  }

  msgEl.innerHTML = `
    <div class="message-content">${content}</div>
    <div class="message-footer">
      ${time}
      <span class="status-icon">${statusIcon}</span>
    </div>
  `

  messagesEl.appendChild(msgEl)
  messagesEl.scrollTop = messagesEl.scrollHeight

  if (type === 'sent') {
    createIcons({ icons: { Check, CheckCheck } })
  }

  return msgEl
}

// Global exposure for the onclick handler
; (window as any).speak = speak

// Setup all listeners
function setupListeners() {
  if (chatForm) chatForm.addEventListener('submit', handleChatSubmit)

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault()
      const email = (document.getElementById('email') as HTMLInputElement).value
      const password = (document.getElementById('password') as HTMLInputElement).value

      updateDebugStatus('Authenticating...')
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          updateDebugStatus('Creating Account...')
          const { error: signUpError } = await supabase.auth.signUp({ email, password })
          if (signUpError) alert(signUpError.message)
          else alert('Success! Check your email for confirmation.')
        } else alert(error.message)
      }
    })
  }

  if (settingsBtn) {
    settingsBtn.addEventListener('click', async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profile) {
        ; (document.getElementById('edit-display-name') as HTMLInputElement).value = profile.display_name || ''
          ; (document.getElementById('edit-username') as HTMLInputElement).value = profile.username || ''
          ; (document.getElementById('edit-bio') as HTMLInputElement).value = profile.bio || ''
        settingsModal.classList.remove('hidden')
      }
    })
  }

  if (closeSettingsBtn) {
    closeSettingsBtn.addEventListener('click', () => {
      settingsModal.classList.add('hidden')
    })
  }

  if (settingsForm) {
    settingsForm.addEventListener('submit', async (e) => {
      e.preventDefault()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const displayName = (document.getElementById('edit-display-name') as HTMLInputElement).value
      const username = (document.getElementById('edit-username') as HTMLInputElement).value
      const bio = (document.getElementById('edit-bio') as HTMLInputElement).value

      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: displayName,
          username: username,
          bio: bio
        })
        .eq('id', user.id)

      if (error) {
        alert(error.message)
      } else {
        updateDebugStatus('Profile Saved')
        settingsModal.classList.add('hidden')
        fetchUserProfile(user.id)
        setTimeout(() => updateDebugStatus('Online'), 2000)
      }
    })
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await supabase.auth.signOut()
    })
  }

  if (backToSidebarBtn) {
    backToSidebarBtn.addEventListener('click', () => {
      showMobileSidebar()
    })
  }
}

// Start app
document.addEventListener('DOMContentLoaded', () => {
  initElements()
  setupListeners()
  setupNavigation()
  // onAuthStateChange will handle initial session check automatically
})
