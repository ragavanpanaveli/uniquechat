import './styles/main.css'
import './styles/layout.css'
import { supabase } from './lib/supabase'
import { createIcons, Settings, LogOut, Send, MessageSquare, Users, Sparkles, Volume2, Check, CheckCheck, ArrowLeft, Paperclip, Square, X, Plus, FolderOpen, FileText, Film, Music, Image, Download } from 'lucide'

// Initial UI Setup
createIcons({
  icons: { Settings, LogOut, Send, MessageSquare, Users, Sparkles, Volume2, Check, CheckCheck, ArrowLeft, Paperclip, Square, X, FolderOpen, FileText, Film, Music, Image, Download }
})


let authSection: HTMLElement, mainSection: HTMLElement, loginForm: HTMLFormElement
let logoutBtn: HTMLElement, settingsBtn: HTMLElement, settingsModal: HTMLElement
let closeSettingsBtn: HTMLElement, settingsForm: HTMLFormElement
let createGroupModal: HTMLElement, closeCreateGroupBtn: HTMLElement, createGroupForm: HTMLFormElement
let addMemberModal: HTMLElement, closeAddMemberBtn: HTMLElement, addMemberBtn: HTMLElement
let messageInput: HTMLInputElement, chatForm: HTMLFormElement
let backToSidebarBtn: HTMLElement
let fileInput: HTMLInputElement, fileBtn: HTMLElement, fileUploadProgress: HTMLElement
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
  messageInput.placeholder = "Type message or /generate [prompt]..."
  chatForm = document.getElementById('chat-form') as HTMLFormElement
  backToSidebarBtn = document.getElementById('back-to-sidebar')!
  fileInput = document.getElementById('file-upload') as HTMLInputElement
  fileBtn = document.getElementById('file-btn')!
  fileUploadProgress = document.getElementById('file-upload-progress')!

  createGroupModal = document.getElementById('create-group-modal')!
  closeCreateGroupBtn = document.getElementById('close-create-group')!
  createGroupForm = document.getElementById('create-group-form') as HTMLFormElement
  addMemberModal = document.getElementById('add-member-modal')!
  closeAddMemberBtn = document.getElementById('close-add-member')!
  addMemberBtn = document.getElementById('add-member-btn')!

  if (!settingsForm) console.error('Settings form not found in DOM')

  // Create a visible debug bar
  const debugBar = document.createElement('div')
  debugBar.id = 'debug-bar'
  const isMobile = window.innerWidth < 768
  debugBar.style.cssText = `position:fixed; ${isMobile ? 'bottom:10px' : 'top:10px'}; right:10px; background:rgba(15, 23, 42, 0.9); backdrop-filter:blur(8px); color:white; font-size:10px; padding:6px 12px; z-index:9999; border-radius:30px; border:1px solid rgba(255,255,255,0.1); box-shadow:0 10px 30px rgba(0,0,0,0.5); pointer-events:none; transition: opacity 0.3s;`
  debugBar.innerHTML = '<span style="opacity:0.6; font-weight:700; letter-spacing:1px; color:var(--primary)">UNIQUECHAT AI</span> <span style="margin:0 8px; opacity:0.3">|</span> <span id="debug-text">Initializing...</span>'
  document.body.appendChild(debugBar)
}

function updateDebugStatus(msg: string) {
  const text = document.getElementById('debug-text')
  if (text) text.innerHTML = msg
}

let activeChatId: string | null = null
let isGroupChat: boolean = false
let aiChatHistory: any[] = []
let friendStatusCache: { [key: string]: string } = {}
let aiResponseMode: 'text' | 'text_voice' | 'voice' = 'text_voice' // Default: text + voice

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

function stopSpeak() {
  window.speechSynthesis.cancel();
  updateDebugStatus('Online');
}


// Auth State Listener
supabase.auth.onAuthStateChange(async (event, session) => {

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
        <h3 style="margin-bottom: 0.25rem; font-size: 1.1rem;">AI Assistant</h3>
        <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1.25rem; line-height:1.5;">
          Powered by Gemini 2.0. Friendly, fast, and speaks Tamil & English.
        </p>

        <div style="margin-bottom: 1.5rem;">
          <div style="font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--text-muted); margin-bottom: 0.75rem;">Response Mode</div>
          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            <button id="mode-text" class="ai-mode-btn ${aiResponseMode === 'text' ? 'active' : ''}" data-mode="text"
              style="display:flex; align-items:center; gap:0.75rem; padding:0.7rem 1rem; border-radius:14px; border:1px solid var(--border); background:${aiResponseMode === 'text' ? 'var(--gradient-main)' : 'rgba(255,255,255,0.04)'}; color:${aiResponseMode === 'text' ? 'white' : 'var(--text-main)'}; cursor:pointer; text-align:left; transition:all 0.2s; font-size:0.85rem; font-weight:600;">
              <span style="font-size:1.1rem;">💬</span> Text Reply Only
            </button>
            <button id="mode-text-voice" class="ai-mode-btn ${aiResponseMode === 'text_voice' ? 'active' : ''}" data-mode="text_voice"
              style="display:flex; align-items:center; gap:0.75rem; padding:0.7rem 1rem; border-radius:14px; border:1px solid var(--border); background:${aiResponseMode === 'text_voice' ? 'var(--gradient-main)' : 'rgba(255,255,255,0.04)'}; color:${aiResponseMode === 'text_voice' ? 'white' : 'var(--text-main)'}; cursor:pointer; text-align:left; transition:all 0.2s; font-size:0.85rem; font-weight:600;">
              <span style="font-size:1.1rem;">💬🔊</span> Text & Voice
            </button>
            <button id="mode-voice" class="ai-mode-btn ${aiResponseMode === 'voice' ? 'active' : ''}" data-mode="voice"
              style="display:flex; align-items:center; gap:0.75rem; padding:0.7rem 1rem; border-radius:14px; border:1px solid var(--border); background:${aiResponseMode === 'voice' ? 'var(--gradient-main)' : 'rgba(255,255,255,0.04)'}; color:${aiResponseMode === 'voice' ? 'white' : 'var(--text-main)'}; cursor:pointer; text-align:left; transition:all 0.2s; font-size:0.85rem; font-weight:600;">
              <span style="font-size:1.1rem;">🔊</span> Voice Only
            </button>
          </div>
        </div>

        <div style="background: rgba(255,255,255,0.03); padding: 1rem; border-radius: 16px; border: 1px solid var(--border); font-size: 0.78rem; color: var(--text-muted); line-height:1.6;">
          <strong style="color: var(--primary); display: block; margin-bottom: 0.4rem;">✨ Capabilities</strong>
          Chat · Tamil / Thanglish · Code Help · Study & Brainstorm
        </div>
      </div>
    `
    // Attach mode button listeners
    document.querySelectorAll('.ai-mode-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const mode = (e.currentTarget as HTMLElement).dataset.mode as typeof aiResponseMode
        aiResponseMode = mode
        // Re-render sidebar to show updated selection
        renderSidebarContent('ai')
      })
    })
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
  } else if (view === 'groups') {
    contentEl.innerHTML = `
      <div style="padding: 1.5rem;">
        <button id="show-create-group" class="btn btn-primary" style="width: 100%; margin-bottom: 1.5rem;">+ Create New Group</button>
        <div id="groups-list"></div>
      </div>
    `
    document.getElementById('show-create-group')?.addEventListener('click', () => {
      createGroupModal.classList.remove('hidden')
    })
    loadGroups()
  }

  createIcons({
    icons: { Settings, LogOut, Send, MessageSquare, Users, Sparkles, Volume2, Check, CheckCheck, ArrowLeft, Paperclip, Square, X, Plus, FolderOpen, FileText, Film, Music, Image, Download }
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

  // Delete the request first
  await supabase.from('friend_requests').delete().eq('id', requestId)

  // Insert BOTH sides so both users see each other in their friends list
  const { error } = await supabase.from('friends').insert([
    { user_id: user.id, friend_id: senderId },   // acceptor → sender
    { user_id: senderId, friend_id: user.id }    // sender → acceptor
  ])

  if (error) {
    // If duplicate (already friends), ignore and continue
    if (error.code !== '23505') {
      console.error('Error adding friend:', error)
      alert('Failed to add friend: ' + error.message)
      return
    }
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
  aiChatHistory = [] // Reset history on each AI tab entry
  if (currentRealtimeChannel) {
    currentRealtimeChannel.unsubscribe()
    currentRealtimeChannel = null
  }

  const chatHeaderName = document.getElementById('active-chat-name')!
  const chatHeaderStatus = document.getElementById('active-chat-status')!
  chatHeaderName.textContent = '✨ UniqueChat AI'

  const modeLabel = aiResponseMode === 'text' ? '💬 Text Only' : aiResponseMode === 'text_voice' ? '💬🔊 Text & Voice' : '🔊 Voice Only'
  chatHeaderStatus.textContent = `Gemini 2.0 • ${modeLabel}`

  const messagesEl = document.getElementById('messages')!
  messagesEl.innerHTML = `
    <div class="empty-state" style="text-align: center; margin: auto; padding: 2rem; max-width: 320px;">
      <div style="font-size: 3rem; margin-bottom: 1rem; animation: floatCard 3s ease-in-out infinite;">🤖</div>
      <h3 style="margin-bottom: 0.5rem; font-size:1.1rem;">Hey! I'm your AI Best Friend</h3>
      <p style="font-size: 0.8rem; color: var(--text-muted); line-height:1.6;">Ask me anything in Tamil, English, or Thanglish 🌟<br><span style="opacity:0.5;">Mode: ${modeLabel}</span></p>
    </div>
  `
  showMobileChat()
}

async function loadRecentChats() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  // Use !friend_id to specify which foreign key to use for the join
  const { data: friends, error } = await supabase
    .from('friends')
    .select('*, profiles!friend_id(*)')
    .eq('user_id', user.id)

  if (error) {
    console.error('Error loading friends:', error)
  }

  const listEl = document.getElementById('recent-chats-list')!
  if (!friends || friends.length === 0) {
    listEl.innerHTML = '<p style="font-size: 0.8125rem; color: var(--text-muted); text-align:center; padding: 2rem;">No chats yet.<br>Add some friends to start messaging!</p>'
    return
  }

  listEl.innerHTML = (friends as any[]).filter(f => f.profiles).map(friend => {
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
      isGroupChat = false
      selectChat(friendId!, friendName!)
    })
  })
}

async function loadGroups() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: groups, error } = await supabase
    .from('chat_group_members')
    .select('group_id, chat_groups(*)')
    .eq('user_id', user.id)
    .eq('status', 'accepted')

  const { data: invitations } = await supabase
    .from('chat_group_members')
    .select('id, group_id, chat_groups(*)')
    .eq('user_id', user.id)
    .eq('status', 'pending')

  const listEl = document.getElementById('groups-list')!
  let html = ''

  if (invitations && invitations.length > 0) {
    html += `
      <div style="margin-bottom: 1.5rem;">
        <div style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.05em; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.5rem;">
          Invitations <span style="background: var(--accent); color: white; padding: 2px 6px; border-radius: 10px; font-size: 0.6rem;">${invitations.length}</span>
        </div>
        ${(invitations as any[]).filter(inv => inv.chat_groups).map(inv => `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem; background: rgba(255,255,255,0.02); border-radius:12px; margin-bottom: 0.5rem; border: 1px solid var(--border);">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
               <div style="width: 32px; height: 32px; border-radius: 50%; background: ${getAvatarGradient((inv.chat_groups as any).id)}; display:flex; align-items:center; justify-content:center; color:white; font-weight:bold; font-size:0.7rem;">
                ${((inv.chat_groups as any).name?.[0] || 'G').toUpperCase()}
               </div>
               <span style="font-size: 0.8125rem; font-weight:600;">${(inv.chat_groups as any).name}</span>
            </div>
            <div style="display: flex; gap: 0.5rem;">
              <button class="btn btn-primary accept-group" data-inv-id="${inv.id}" style="padding: 0.35rem 0.7rem; font-size: 0.7rem; border-radius:30px;">Join</button>
              <button class="btn reject-group" data-inv-id="${inv.id}" style="padding: 0.35rem 0.7rem; font-size: 0.7rem; border: 1px solid var(--border); border-radius:30px;">✕</button>
            </div>
          </div>
        `).join('')}
        <div style="height: 1px; background: var(--border); margin: 1.5rem 0;"></div>
      </div>
    `
  }

  if (error || !groups || groups.length === 0) {
    html += '<p style="font-size: 0.8125rem; color: var(--text-muted); text-align:center; padding: 2rem;">No groups joined yet.</p>'
  } else {
    html += (groups as any[]).filter(gm => gm.chat_groups).map(gm => `
      <div class="chat-item ${activeChatId === (gm.chat_groups as any).id ? 'active' : ''}" data-group-id="${(gm.chat_groups as any).id}" data-group-name="${(gm.chat_groups as any).name}">
        <div style="width: 44px; height: 44px; border-radius: 50%; background: ${getAvatarGradient((gm.chat_groups as any).id)}; overflow: hidden; border: 2px solid transparent; display: flex; align-items: center; justify-content: center;">
           <span style="color:white; font-weight:bold; font-size: 1rem;">${((gm.chat_groups as any).name || 'G').charAt(0).toUpperCase()}</span>
        </div>
        <div style="flex: 1;">
          <div style="font-weight: 600; font-size: 0.875rem; color: var(--text-main);">${(gm.chat_groups as any).name}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${(gm.chat_groups as any).description || 'Group chat'}</div>
        </div>
      </div>
    `).join('')
  }

  listEl.innerHTML = html

  document.querySelectorAll('.accept-group').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const target = e.currentTarget as HTMLButtonElement
      const { invId } = target.dataset
      target.disabled = true
      target.textContent = 'Joining...'

      const { error } = await supabase.from('chat_group_members').update({ status: 'accepted' }).eq('id', invId)

      if (error) {
        console.error('Join Error:', error)
        alert('Failed to join group: ' + error.message)
        target.disabled = false
        target.textContent = 'Join'
      } else {
        updateDebugStatus('Group Joined!')
        loadGroups()
      }
    })
  })

  document.querySelectorAll('.reject-group').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const target = e.currentTarget as HTMLButtonElement
      const { invId } = target.dataset
      target.disabled = true

      const { error } = await supabase.from('chat_group_members').delete().eq('id', invId)
      if (error) {
        alert('Error: ' + error.message)
        target.disabled = false
      } else {
        loadGroups()
      }
    })
  })

  document.querySelectorAll('.chat-item').forEach(item => {
    item.addEventListener('click', (e) => {
      const { groupId, groupName } = (e.currentTarget as HTMLElement).dataset
      document.querySelectorAll('.chat-item').forEach(cl => cl.classList.remove('active'))
        ; (e.currentTarget as HTMLElement).classList.add('active')
      isGroupChat = true
      selectChat(groupId!, groupName!)
    })
  })
}

async function createGroup(name: string, description: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: group, error } = await supabase
    .from('chat_groups')
    .insert([{ name, description, created_by: user.id }])
    .select()
    .single()

  if (error) {
    alert('Error creating group: ' + error.message)
    return
  }

  // Add creator as admin member
  await supabase.from('chat_group_members').insert([{
    group_id: group.id,
    user_id: user.id,
    role: 'admin',
    status: 'accepted'
  }])

  updateDebugStatus('Group Created!')
  createGroupModal.classList.add('hidden')
  loadGroups()
}

async function loadFriendsForAdding(groupId: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: friends } = await supabase
    .from('friends')
    .select('*, profiles!friend_id(*)')
    .eq('user_id', user.id)

  const listEl = document.getElementById('friends-to-add-list')!
  if (!friends || friends.length === 0) {
    listEl.innerHTML = '<p style="font-size: 0.8125rem; color: var(--text-muted); text-align:center;">No friends to add.</p>'
    return
  }

  listEl.innerHTML = (friends as any[]).map(friend => `
    <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem; margin-bottom: 0.5rem; border-radius: 8px; background: rgba(255,255,255,0.02); border: 1px solid var(--border);">
      <div style="display: flex; align-items: center; gap: 0.75rem;">
        <div style="width: 32px; height: 32px; border-radius: 50%; background: ${getAvatarGradient(friend.profiles.id)}; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 0.7rem;">
          ${(friend.profiles.display_name?.[0] || 'U').toUpperCase()}
        </div>
        <span style="font-size: 0.8125rem;">${friend.profiles.display_name}</span>
      </div>
      <button class="btn btn-primary add-to-group-btn" data-user-id="${friend.profiles.id}" data-group-id="${groupId}" style="padding: 0.35rem 0.7rem; font-size: 0.7rem; border-radius: 30px;">Add</button>
    </div>
  `).join('')

  document.querySelectorAll('.add-to-group-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const { userId, groupId } = (e.currentTarget as HTMLButtonElement).dataset
      await addMemberToGroup(groupId!, userId!)
        ; (e.currentTarget as HTMLButtonElement).disabled = true
        ; (e.currentTarget as HTMLButtonElement).textContent = 'Added'
    })
  })
}

async function addMemberToGroup(groupId: string, userId: string) {
  const { error } = await supabase.from('chat_group_members').insert([{
    group_id: groupId,
    user_id: userId,
    status: 'pending',
    role: 'member'
  }])

  if (error) {
    if (error.code === '23505') alert('Invitation already sent or user in group!')
    else alert('Error: ' + error.message)
  }
}

async function selectChat(targetId: string, targetName: string) {
  activeChatId = targetId
  const chatHeaderName = document.getElementById('active-chat-name')!
  const chatHeaderStatus = document.getElementById('active-chat-status')!
  const groupActions = document.getElementById('group-actions')!
  chatHeaderName.textContent = targetName
  chatHeaderStatus.textContent = isGroupChat ? 'Group Chat' : 'Connected'

  if (isGroupChat) {
    groupActions.classList.remove('hidden')
  } else {
    groupActions.classList.add('hidden')
  }

  showMobileChat()

  const messagesEl = document.getElementById('messages')!
  messagesEl.innerHTML = ''

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  let query = supabase.from('messages').select('*, profiles!sender_id(display_name)')

  if (isGroupChat) {
    query = query.eq('group_id', targetId)
  } else {
    query = query.or(`and(sender_id.eq.${user.id},receiver_id.eq.${targetId}),and(sender_id.eq.${targetId},receiver_id.eq.${user.id})`)
  }

  const { data: messages } = await query.order('created_at', { ascending: true })

  if (messages) {
    messages.forEach(msg => {
      const type = msg.sender_id === user.id ? 'sent' : 'received'
      if (msg.file_url) {
        const senderName = isGroupChat && type === 'received' ? (msg.profiles?.display_name || 'User') : null
        appendFileMessage(msg.file_url, msg.file_name || 'File', msg.file_type || 'application/octet-stream', type, msg.created_at, msg.is_seen, senderName)
      } else {
        const content = isGroupChat && type === 'received' ? `<div style="font-size:0.7rem; color:var(--primary); font-weight:700;">${msg.profiles?.display_name || 'User'}</div>${msg.content}` : msg.content
        appendMessage(content, type, msg.created_at, msg.is_seen)
      }
    })
  }

  if (!isGroupChat) {
    // Mark all unread messages as seen
    await supabase
      .from('messages')
      .update({ is_seen: true })
      .eq('receiver_id', user.id)
      .eq('sender_id', targetId)
      .eq('is_seen', false)
  }

  subscribeToMessages(user.id, targetId)
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

function subscribeToMessages(userId: string, targetId: string) {
  if (currentRealtimeChannel) {
    currentRealtimeChannel.unsubscribe()
  }

  // Use a more generic filter or multiple channels if needed, 
  // but for now, we filter by receiver (1-on-1) or group_id (Group)
  // Remove restrictive filter so we catch both sent and received events for UI updates
  currentRealtimeChannel = supabase
    .channel('messages_realtime')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages'
    }, async (payload) => {
      // Logic for showing NEW messages from others
      if (isGroupChat) {
        if (payload.new.sender_id !== userId && payload.new.group_id === targetId) {
          const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', payload.new.sender_id).single()
          if (payload.new.file_url) {
            appendFileMessage(payload.new.file_url, payload.new.file_name || 'File', payload.new.file_type || 'application/octet-stream', 'received', payload.new.created_at, false, profile?.display_name || 'User')
          } else {
            const content = `<div style="font-size:0.7rem; color:var(--primary); font-weight:700;">${profile?.display_name || 'User'}</div>${payload.new.content}`
            appendMessage(content, 'received', payload.new.created_at)
          }
        }
      } else {
        // 1-on-1: only append if it's from the person we are currently chatting with
        if (payload.new.sender_id === targetId && payload.new.receiver_id === userId) {
          if (payload.new.file_url) {
            appendFileMessage(payload.new.file_url, payload.new.file_name || 'File', payload.new.file_type || 'application/octet-stream', 'received', payload.new.created_at)
          } else {
            appendMessage(payload.new.content, 'received', payload.new.created_at)
          }
          supabase.from('messages').update({ is_seen: true }).eq('id', payload.new.id).then()
        }
      }
    })
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'messages'
    }, (payload) => {
      if (!isGroupChat) {
        // Handle blue ticks for 1-on-1
        if (payload.new.receiver_id === targetId && payload.new.is_seen) {
          const messagesEl = document.getElementById('messages')!
          const lastMsg = Array.from(messagesEl.querySelectorAll('.message-sent')).pop()
          if (lastMsg) {
            const iconEl = lastMsg.querySelector('.status-icon')
            if (iconEl) {
              iconEl.innerHTML = `<i data-lucide="check-check" style="width:14px; color: #3b82f6;"></i>`
              createIcons({ icons: { Settings, LogOut, Send, MessageSquare, Users, Sparkles, Volume2, Check, CheckCheck, ArrowLeft, Paperclip, Square, X, Plus, FolderOpen, FileText, Film, Music, Image, Download } })
            }
          }
        }
      }
    })
    .subscribe()  // ← FIXED: was missing, so real-time messages never arrived!
}

async function sendMessage(content: string, targetId: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !content.trim()) return

  // Optimistic UI: clear input and show message immediately
  const messageText = content.trim()
  messageInput.value = ''
  appendMessage(messageText, 'sent', new Date().toISOString(), false)

  const payload: any = {
    sender_id: user.id,
    content: messageText
  }

  if (isGroupChat) {
    payload.group_id = targetId
  } else {
    payload.receiver_id = targetId
  }

  const { error } = await supabase.from('messages').insert([payload])

  if (error) {
    console.error('Failed to send message:', error)
    updateDebugStatus('Error: Failed to send')
    // Optionally: show an error icon on that specific message bubble
  }
}

// ===== FILE SHARING FEATURE =====


function getFileIconEmoji(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼️'
  if (mimeType.startsWith('video/')) return '🎬'
  if (mimeType.startsWith('audio/')) return '🎵'
  if (mimeType.includes('pdf')) return '📄'
  if (mimeType.includes('word') || mimeType.includes('document')) return '📝'
  if (mimeType.includes('sheet') || mimeType.includes('excel') || mimeType.includes('csv')) return '📊'
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z')) return '📦'
  return '📁'
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

async function uploadFileToSupabase(file: File): Promise<{ url: string; fileName: string; fileType: string } | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const ext = file.name.split('.').pop() || 'bin'
  const filePath = `${user.id}/${Date.now()}_${Math.random().toString(36).substring(2)}.${ext}`

  // Show progress
  fileUploadProgress.classList.remove('hidden')
  const progressText = document.getElementById('upload-progress-text')!
  progressText.textContent = `Uploading ${file.name}...`
  updateDebugStatus('Uploading file...')

  try {
    const { error: uploadError } = await supabase.storage
      .from('chat-files')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      alert(`Upload failed: ${uploadError.message}\n\nMake sure you created the 'chat-files' bucket in Supabase Storage!`)
      return null
    }

    const { data: { publicUrl } } = supabase.storage
      .from('chat-files')
      .getPublicUrl(filePath)

    return { url: publicUrl, fileName: file.name, fileType: file.type }
  } catch (err: any) {
    console.error('Upload error:', err)
    alert('Upload failed: ' + err.message)
    return null
  } finally {
    fileUploadProgress.classList.add('hidden')
    updateDebugStatus('Online')
  }
}

async function sendFileMessage(file: File) {
  if (!activeChatId) {
    alert('Please select a friend or group to send files!')
    return
  }

  const activeTab = document.querySelector('.tab.active')?.id
  if (activeTab === 'tab-ai') {
    alert('File sharing is only for friend and group chats! Use the 📎 button to send images to AI.')
    return
  }

  const MAX_SIZE = 50 * 1024 * 1024 // 50MB
  if (file.size > MAX_SIZE) {
    alert(`File too large! Maximum size is 50MB. Your file: ${formatFileSize(file.size)}`)
    return
  }

  const result = await uploadFileToSupabase(file)
  if (!result) return

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const payload: any = {
    sender_id: user.id,
    content: `📎 ${result.fileName}`,
    file_url: result.url,
    file_name: result.fileName,
    file_type: result.fileType
  }

  if (isGroupChat) {
    payload.group_id = activeChatId
  } else {
    payload.receiver_id = activeChatId
  }

  const { error } = await supabase.from('messages').insert([payload])

  if (error) {
    console.error('Failed to send file message:', error)
    alert('Failed to send file: ' + error.message)
  } else {
    // Show locally immediately
    appendFileMessage(result.url, result.fileName, result.fileType, 'sent')
    updateDebugStatus('File sent!')
    setTimeout(() => updateDebugStatus('Online'), 2000)
  }
}

function appendFileMessage(
  fileUrl: string,
  fileName: string,
  fileType: string,
  type: 'sent' | 'received',
  timestamp?: string,
  isSeen: boolean = false,
  senderName?: string | null
) {
  const messagesEl = document.getElementById('messages')!
  const emptyState = messagesEl.querySelector('.empty-state')
  if (emptyState) emptyState.remove()

  const msgEl = document.createElement('div')
  msgEl.className = `message message-${type} file-message`

  const time = timestamp
    ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  let statusIcon = ''
  if (type === 'sent') {
    const isOnline = activeChatId && friendStatusCache[activeChatId] === 'online'
    if (isSeen) {
      statusIcon = `<i data-lucide="check-check" style="width:14px; color: #3b82f6;"></i>`
    } else if (isOnline) {
      statusIcon = `<i data-lucide="check-check" style="width:14px; color: #94a3b8;"></i>`
    } else {
      statusIcon = `<i data-lucide="check" style="width:14px; color: #94a3b8;"></i>`
    }
  }

  const isImage = fileType.startsWith('image/')
  const isVideo = fileType.startsWith('video/')
  const emoji = getFileIconEmoji(fileType)
  const senderLabel = senderName ? `<div style="font-size:0.7rem; color:var(--primary); font-weight:700; margin-bottom:4px;">${senderName}</div>` : ''

  let fileContent = ''
  if (isImage) {
    fileContent = `
      ${senderLabel}
      <img src="${fileUrl}" class="message-image" onclick="window.open('${fileUrl}', '_blank')" style="max-height:220px; width:100%; object-fit:cover; border-radius:12px; margin-bottom:6px; cursor:pointer;">
      <div class="file-card-name" style="font-size:0.78rem; opacity:0.8;">${emoji} ${fileName}</div>
    `
  } else if (isVideo) {
    fileContent = `
      ${senderLabel}
      <video controls style="max-width:100%; max-height:200px; border-radius:12px; margin-bottom:6px; display:block;">
        <source src="${fileUrl}" type="${fileType}">
      </video>
      <div class="file-card-name" style="font-size:0.78rem; opacity:0.8;">${emoji} ${fileName}</div>
    `
  } else {
    fileContent = `
      ${senderLabel}
      <a href="${fileUrl}" target="_blank" download="${fileName}" class="file-download-card">
        <div class="file-icon-big">${emoji}</div>
        <div class="file-info">
          <div class="file-card-name">${fileName}</div>
          <div class="file-card-type">${fileType.split('/').pop()?.toUpperCase() || 'FILE'} • Tap to download</div>
        </div>
        <div class="file-download-icon">⬇️</div>
      </a>
    `
  }

  msgEl.innerHTML = `
    <div class="message-content">${fileContent}</div>
    <div class="message-footer-row">
      <div class="message-actions"></div>
      <div class="message-footer">
        ${time}
        <span class="status-icon">${statusIcon}</span>
      </div>
    </div>
  `

  messagesEl.appendChild(msgEl)
  messagesEl.scrollTop = messagesEl.scrollHeight

  createIcons({ icons: { Settings, LogOut, Send, MessageSquare, Users, Sparkles, Volume2, Check, CheckCheck, ArrowLeft, Paperclip, Square, X, Plus, FolderOpen, FileText, Film, Music, Image, Download } })
  return msgEl
}

async function handleChatSubmit(e: Event) {
  e.preventDefault()
  const content = messageInput.value.trim()
  if (!content) return

  messageInput.value = ''

  const activeTab = document.querySelector('.tab.active')?.id
  if (activeTab === 'tab-ai') {
    appendMessage(content, 'sent')

    // Disable input while AI is thinking
    messageInput.disabled = true
    const sendBtn = chatForm.querySelector('button[type="submit"]') as HTMLButtonElement
    if (sendBtn) sendBtn.disabled = true

    const typingMsg = appendMessage('AI is thinking... 🤔', 'received')
    const aiResponse = await getAIResponse(content)

    // Re-enable input
    messageInput.disabled = false
    if (sendBtn) sendBtn.disabled = false
    messageInput.focus()

    const aiText: string = typeof aiResponse === 'string' ? aiResponse : (aiResponse?.text || 'Error getting response')
    const generatedImage: string | null = aiResponse?.generatedImage || null

    // Voice Only mode: don't show text in bubble, just speak
    if (aiResponseMode === 'voice') {
      typingMsg.querySelector('.message-content')!.textContent = '🔊 (Voice response playing...)'
      typingMsg.classList.remove('typing-state')
      speak(aiText)
    } else {
      // Text or Text+Voice: display the text
      typingMsg.querySelector('.message-content')!.innerHTML = aiText
      typingMsg.classList.remove('typing-state')

      // Show generated image if present
      if (generatedImage) {
        const genImgHtml = `<img src="${generatedImage}" class="message-image" onclick="window.open('${generatedImage}', '_blank')" style="margin-top:8px;">`
        typingMsg.querySelector('.message-content')!.insertAdjacentHTML('afterbegin', genImgHtml)
      }

      if (aiResponseMode === 'text_voice') {
        // Auto-speak the response
        speak(aiText)
      }

      // Show voice control buttons so user can replay/stop
      const safeText = btoa(unescape(encodeURIComponent(aiText)));
      const speakerHtml = `
        <div class="voice-controls">
          <button class="control-btn" onclick="window.speak(decodeURIComponent(escape(atob('${safeText}'))))" title="Replay">
            <i data-lucide="volume-2" style="width:14px;height:14px;"></i>
          </button>
          <button class="control-btn stop" onclick="window.stopSpeak()" title="Stop">
            <i data-lucide="square" style="width:10px;height:10px;"></i>
          </button>
        </div>`

      const actionsContainer = typingMsg.querySelector('.message-actions')
      if (actionsContainer) {
        actionsContainer.innerHTML = speakerHtml
      }
    }

    createIcons({ icons: { Settings, LogOut, Send, MessageSquare, Users, Sparkles, Volume2, Check, CheckCheck, ArrowLeft, Paperclip, Square, X, Plus, FolderOpen, FileText, Film, Music, Image, Download } })

  } else if (activeChatId) {
    // sendMessage handles optimistic UI (appends message + clears input internally)
    await sendMessage(content, activeChatId)
  }
}

async function getAIResponse(message: string): Promise<any> {
  try {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    const url = isLocal
      ? 'http://localhost:3000/api/chat'
      : '/api/chat'; // Vercel: frontend + serverless API same domain

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history: aiChatHistory })
    });

    if (!response.ok) {
      let errorMsg = 'Failed to get AI response';
      try {
        const errData = await response.json();
        errorMsg = errData.error || errorMsg;
      } catch (_) { errorMsg = `HTTP ${response.status}` }
      return { text: `❌ ${errorMsg}` };
    }

    const data = await response.json();

    // Update history for contextual follow-up conversations
    if (data.text) {
      aiChatHistory.push({ role: 'user', parts: [{ text: message }] });
      aiChatHistory.push({ role: 'model', parts: [{ text: data.text }] });
    }

    return data; // { text: '...', generatedImage?: '...' }
  } catch (error: any) {
    return { text: `❌ Connection Error: Make sure the backend is running. (${error.message})` };
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
      statusIcon = `<i data-lucide="check-check" style="width:14px; color: #3b82f6;"></i>`
    } else if (isOnline) {
      statusIcon = `<i data-lucide="check-check" style="width:14px; color: #94a3b8;"></i>`
    } else {
      statusIcon = `<i data-lucide="check" style="width:14px; color: #94a3b8;"></i>`
    }
  }

  msgEl.innerHTML = `
    <div class="message-content">${content}</div>
    <div class="message-footer-row">
      <div class="message-actions"></div>
      <div class="message-footer">
        ${time}
        <span class="status-icon">${statusIcon}</span>
      </div>
    </div>
  `

  messagesEl.appendChild(msgEl)
  messagesEl.scrollTop = messagesEl.scrollHeight

  createIcons({ icons: { Settings, LogOut, Send, MessageSquare, Users, Sparkles, Volume2, Check, CheckCheck, ArrowLeft, Paperclip, Square, X, Plus, FolderOpen, FileText, Film, Music, Image, Download } })

  return msgEl
}

// Global exposure
; (window as any).speak = speak
  ; (window as any).stopSpeak = stopSpeak


// Setup all listeners
function setupListeners() {
  if (chatForm) chatForm.addEventListener('submit', handleChatSubmit)
  if (fileBtn) fileBtn.addEventListener('click', () => fileInput.click())
  if (fileInput) fileInput.addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    fileInput.value = ''
    await sendFileMessage(file)
  })

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

  if (closeCreateGroupBtn) {
    closeCreateGroupBtn.addEventListener('click', () => {
      createGroupModal.classList.add('hidden')
    })
  }

  if (createGroupForm) {
    createGroupForm.addEventListener('submit', (e) => {
      e.preventDefault()
      const name = (document.getElementById('group-name') as HTMLInputElement).value
      const description = (document.getElementById('group-description') as HTMLInputElement).value
      createGroup(name, description)
    })
  }

  if (addMemberBtn) {
    addMemberBtn.addEventListener('click', () => {
      if (activeChatId) {
        loadFriendsForAdding(activeChatId)
        addMemberModal.classList.remove('hidden')
      }
    })
  }

  if (closeAddMemberBtn) {
    closeAddMemberBtn.addEventListener('click', () => {
      addMemberModal.classList.add('hidden')
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
