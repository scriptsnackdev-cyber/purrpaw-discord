let currentGuildId = null;
let currentChannelId = null;
let selectedCharacterId = null;
let characters = [];
let mentionableItems = [];
let allTextChannels = [];
let messageCache = {};
let selectedFiles = [];

const socket = io();

// UI Elements
const guildList = document.getElementById('guild-list');
const channelList = document.getElementById('channel-list');
const messageLog = document.getElementById('message-log');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const currentChannelName = document.getElementById('current-channel-name');
const memberList = document.getElementById('member-list');

// Mention/Channel Autocomplete
const mentionAutocomplete = document.getElementById('mention-autocomplete');
let autocompleteType = 'mention';
let mentionSearchQuery = '';
let selectedMentionIndex = 0;

// Views
const chatView = document.getElementById('chat-view');
const toolsView = document.getElementById('tools-view');
const openToolsBtn = document.getElementById('open-tools');
const closeToolsBtn = document.getElementById('close-tools');
const goHomeBtn = document.getElementById('go-home');

// Character Modal
const charModal = document.getElementById('char-modal');
const modalTitle = document.getElementById('modal-title');
const charGrid = document.getElementById('char-grid');
const openModalBtn = document.getElementById('open-char-modal');
const closeModalBtn = document.getElementById('close-modal');
const currentCharAvatar = document.getElementById('current-char-avatar');
const charSelectionView = document.getElementById('char-selection-view');
const charCreateView = document.getElementById('char-create-view');
const backToSelectionBtn = document.getElementById('back-to-selection');
const createCharForm = document.getElementById('create-char-form');

// File Upload
const triggerUpload = document.getElementById('trigger-upload');
const fileInput = document.getElementById('file-input');
const attachmentPreviews = document.getElementById('attachment-previews');

// Music Downloader
const musicUrlInput = document.getElementById('music-url');
const fetchMusicBtn = document.getElementById('fetch-music-btn');
const musicPreview = document.getElementById('music-preview');
const downloadStatus = document.getElementById('download-status');
const statusText = document.getElementById('status-text');

// ── Utility: Fetch with Retry ──
async function fetchWithRetry(url, options = {}, retries = 3, backoff = 1000) {
    try {
        const response = await fetch(url, options);
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        return await response.json();
    } catch (error) {
        if (retries > 0) { await new Promise(res => setTimeout(res, backoff)); return fetchWithRetry(url, options, retries - 1, backoff * 2); }
        throw error;
    }
}

// ── Initialization ──
document.addEventListener('DOMContentLoaded', () => { fetchGuilds(); });

// ── View Management ──
function showView(viewId) {
    [chatView, toolsView].forEach(v => v.classList.add('d-none'));
    document.getElementById(viewId).classList.remove('d-none');
    
    // Sidebar indicators
    openToolsBtn.classList.toggle('active', viewId === 'tools-view');
    goHomeBtn.classList.toggle('active', viewId === 'chat-view');
}

openToolsBtn.onclick = () => showView('tools-view');
closeToolsBtn.onclick = () => showView('chat-view');
goHomeBtn.onclick = () => showView('chat-view');

// ── Guilds & Channels ──
async function fetchGuilds() {
    try {
        const guilds = await fetchWithRetry('/api/guilds');
        guildList.innerHTML = '';
        guilds.forEach(guild => {
            const div = document.createElement('div');
            div.className = 'guild-icon';
            div.title = guild.name;
            div.innerHTML = guild.icon ? `<img src="${guild.icon}" alt="${guild.name}">` : `<span>${guild.name.charAt(0)}</span>`;
            div.onclick = () => selectGuild(guild.id, guild.name, div);
            guildList.appendChild(div);
        });
    } catch (e) { showNotification('โหลดเซิร์ฟเวอร์ล้มเหลว 😿'); }
}

async function selectGuild(guildId, guildName, el) {
    currentGuildId = guildId;
    document.querySelectorAll('.guild-icon').forEach(x => x.classList.remove('active'));
    el.classList.add('active');
    document.getElementById('current-guild-display').textContent = guildName;
    fetchChannels(guildId);
    fetchCharacters(guildId);
    fetchMembers(guildId);
    showView('chat-view');
}

async function fetchChannels(guildId) {
    try {
        const channels = await fetchWithRetry(`/api/channels/${guildId}`);
        allTextChannels = channels.filter(c => c.type === 0);
        renderChannels(channels);
    } catch (e) { showNotification('โหลดห้องไม่สำเร็จ 😿'); }
}

function renderChannels(channels) {
    channelList.innerHTML = '';
    channels.forEach(c => {
        const isVoice = c.type === 2;
        const div = document.createElement('div');
        div.className = `channel-item ${currentChannelId === c.id ? 'active' : ''}`;
        div.innerHTML = `<i class="fa-solid ${isVoice ? 'fa-volume-high' : 'fa-hashtag'}"></i> ${c.name}`;
        if (!isVoice) div.onclick = () => selectChannel(c.id, c.name, div);
        channelList.appendChild(div);
        
        if (isVoice && c.members?.length > 0) {
            const vDiv = document.createElement('div');
            vDiv.className = 'voice-members';
            c.members.forEach(m => {
                vDiv.innerHTML += `<div class="voice-member"><img src="${m.avatar}"><span>${m.displayName}</span></div>`;
            });
            channelList.appendChild(vDiv);
        }
    });
}

async function selectChannel(id, name, el) {
    if (currentChannelId) socket.emit('leave_channel', currentChannelId);
    currentChannelId = id;
    currentChannelName.textContent = name;
    document.querySelectorAll('.channel-item').forEach(x => x.classList.remove('active'));
    el.classList.add('active');
    messageInput.disabled = false;
    sendBtn.disabled = false;
    messageInput.placeholder = `ส่งข้อความถึง #${name}`;
    socket.emit('join_channel', id);
    fetchMessages(id);
}

async function fetchMessages(id) {
    try {
        const msgs = await fetchWithRetry(`/api/messages/${currentGuildId}/${id}`);
        renderMessages(msgs);
    } catch (e) { showNotification('โหลดประวัติล้มเหลว 😿'); }
}

function renderMessages(msgs) {
    messageLog.innerHTML = msgs.length ? '' : '<div class="empty-state">ยังไม่มีข้อความเมี๊ยว</div>';
    msgs.forEach(m => appendMessage(m, false));
    messageLog.scrollTop = messageLog.scrollHeight;
}

function appendMessage(m, scroll = true) {
    const div = document.createElement('div');
    div.className = 'message-item';
    const date = new Date(m.timestamp).toLocaleString();
    let attachments = m.attachments?.map(a => `<img class="message-image" src="${a.url}" onclick="window.open('${a.url}')">`).join('') || '';
    div.innerHTML = `<img class="message-avatar" src="${m.author.avatar}">
        <div class="message-content-wrapper">
            <div class="message-author"><span class="name">${m.author.name}</span><span class="time">${date}</span></div>
            <div class="message-text">${formatContent(m.content)}</div>
            ${attachments}
        </div>`;
    messageLog.appendChild(div);
    if (scroll) messageLog.scrollTop = messageLog.scrollHeight;
}

function formatContent(c) {
    if (!c) return '';
    c = c.replace(/(@[^\s]+)/g, '<span class="mention-text">$1</span>');
    c = c.replace(/(#[^\s]+)/g, match => {
        const chan = allTextChannels.find(x => x.name === match.slice(1));
        return chan ? `<span class="mention-text channel-mention" onclick="selectChannel('${chan.id}','${chan.name}',null)">${match}</span>` : match;
    });
    return c.replace(/\n/g, '<br>');
}

// ── Send Message ──
async function sendMessage() {
    let msg = messageInput.value.trim();
    if (!msg && selectedFiles.length === 0) return;
    
    // Translation
    mentionableItems.forEach(i => {
        const r = new RegExp(`@${i.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
        msg = msg.replace(r, i.type === 'member' ? `<@${i.id}>` : `<@&${i.id}>`);
    });
    allTextChannels.forEach(c => {
        const r = new RegExp(`#${c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
        msg = msg.replace(r, `<#${c.id}>`);
    });

    const form = new FormData();
    form.append('guildId', currentGuildId);
    form.append('channelId', currentChannelId);
    form.append('characterId', selectedCharacterId || '');
    form.append('message', msg);
    selectedFiles.forEach(f => form.append('files', f));

    try {
        const res = await fetch('/api/speak', { method: 'POST', body: form });
        if (res.ok) { messageInput.value = ''; selectedFiles = []; renderPreviews(); }
    } catch (e) { showNotification('ส่งข้อความล้มเหลว 😿'); }
}

sendBtn.onclick = sendMessage;
messageInput.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } };

// ── Music Downloader ──
fetchMusicBtn.onclick = async () => {
    const url = musicUrlInput.value.trim();
    if (!url) return showNotification('กรุณาใส่ลิงก์ก่อนเมี๊ยว!');

    musicPreview.classList.add('d-none');
    downloadStatus.classList.remove('d-none');
    statusText.textContent = 'กำลังตรวจสอบลิงก์...';

    try {
        const info = await fetchWithRetry(`/api/music/info?url=${encodeURIComponent(url)}`);
        downloadStatus.classList.add('d-none');
        musicPreview.classList.remove('d-none');
        musicPreview.innerHTML = `
            <img src="${info.thumbnail}" alt="Thumbnail">
            <div class="music-info">
                <div class="title">${info.title}</div>
                <div class="author">${info.author} • ${info.duration}</div>
                <button class="download-btn" id="start-download-btn">
                    <i class="fa-solid fa-download"></i> ดาวน์โหลด MP3
                </button>
            </div>
        `;
        document.getElementById('start-download-btn').onclick = () => {
            window.location.href = `/api/music/download?url=${encodeURIComponent(url)}&title=${encodeURIComponent(info.title)}`;
            showNotification('กำลังเริ่มดาวน์โหลด... กรุณารอสักครู่เมี๊ยว! 🎶');
        };
    } catch (e) {
        downloadStatus.classList.add('d-none');
        showNotification('ตรวจสอบลิงก์ไม่สำเร็จ หรือไม่รองรับเมี๊ยว 😿');
    }
};

// ── Characters ──
async function fetchCharacters(gid) {
    try {
        characters = await fetchWithRetry(`/api/characters/${gid}`);
        renderCharacterGrid();
    } catch (e) {}
}
function renderCharacterGrid() {
    charGrid.innerHTML = `<div class="char-card ${!selectedCharacterId ? 'active' : ''}" onclick="selectCharacter(null)">
        <img src="https://cdn.discordapp.com/embed/avatars/0.png"><span>บอทหลัก</span>
    </div>`;
    characters.forEach(c => {
        const div = document.createElement('div');
        div.className = `char-card ${selectedCharacterId === c.id ? 'active' : ''}`;
        div.innerHTML = `<img src="${c.image_url}"><span>${c.name}</span>`;
        div.onclick = () => selectCharacter(c);
        charGrid.appendChild(div);
    });
    const add = document.createElement('div');
    add.className = 'char-card add-card';
    add.innerHTML = '<i class="fa-solid fa-plus"></i><span>เพิ่มบทบาท</span>';
    add.onclick = () => { charSelectionView.classList.add('d-none'); charCreateView.classList.remove('d-none'); };
    charGrid.appendChild(add);
}
function selectCharacter(c) {
    selectedCharacterId = c?.id || null;
    currentCharAvatar.src = c?.image_url || 'https://cdn.discordapp.com/embed/avatars/0.png';
    closeModal();
}
openModalBtn.onclick = () => { charModal.classList.remove('hidden'); charSelectionView.classList.remove('d-none'); charCreateView.classList.add('d-none'); };
closeModalBtn.onclick = closeModal;
function closeModal() { charModal.classList.add('hidden'); }

// ── Members ──
async function fetchMembers(gid) {
    try {
        const data = await fetchWithRetry(`/api/members/${gid}`);
        mentionableItems = [{id:'everyone', name:'everyone', type:'special'}, {id:'here', name:'here', type:'special'}];
        data.roles.forEach(r => mentionableItems.push({...r, type:'role'}));
        data.groups.flatMap(g => g.members).forEach(m => mentionableItems.push({...m, name:m.displayName, type:'member'}));
        renderMembers(data.groups);
    } catch (e) {}
}
function renderMembers(groups) {
    memberList.innerHTML = '';
    groups.forEach(g => {
        memberList.innerHTML += `<div class="role-header">${g.roleName} — ${g.members.length}</div>`;
        g.members.forEach(m => {
            memberList.innerHTML += `<div class="member-item"><img src="${m.avatar}"><span style="color:${m.color}">${m.displayName}</span></div>`;
        });
    });
}

// ── Notification ──
function showNotification(t) {
    const n = document.getElementById('notification');
    n.textContent = t; n.classList.remove('hidden');
    setTimeout(() => n.classList.add('hidden'), 3000);
}

// ── Socket ──
socket.on('new_message', m => appendMessage(m));
