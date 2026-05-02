let currentGuildId = null;
let currentChannelId = null;
let selectedCharacterId = null;
let characters = [];
let mentionableItems = [];
let messageCache = {};
let selectedFiles = [];

const socket = io();

const guildList = document.getElementById('guild-list');
const channelList = document.getElementById('channel-list');
const messageLog = document.getElementById('message-log');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const currentGuildName = document.getElementById('current-guild-name');
const currentChannelName = document.getElementById('current-channel-name');
const memberList = document.getElementById('member-list');

// Mention Autocomplete
const mentionAutocomplete = document.getElementById('mention-autocomplete');
let mentionSearchQuery = '';
let selectedMentionIndex = 0;

// UI Elements
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
const triggerUpload = document.getElementById('trigger-upload');
const fileInput = document.getElementById('file-input');
const attachmentPreviews = document.getElementById('attachment-previews');

// ── Utility: Fetch with Exponential Backoff ──
async function fetchWithRetry(url, options = {}, retries = 3, backoff = 1000) {
    try {
        const response = await fetch(url, options);
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        return await response.json();
    } catch (error) {
        if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, backoff));
            return fetchWithRetry(url, options, retries - 1, backoff * 2);
        }
        throw error;
    }
}

// ── Initialization ──
document.addEventListener('DOMContentLoaded', () => { fetchGuilds(); });

// ── Socket Events ──
socket.on('new_message', (msg) => {
    if (messageCache[currentChannelId]) {
        messageCache[currentChannelId].messages.push(msg);
        if (messageCache[currentChannelId].messages.length > 150) messageCache[currentChannelId].messages.shift();
    }
    appendMessage(msg);
});
socket.on('voice_update', (guildId) => { if (currentGuildId === guildId) fetchChannels(guildId, true); });

// ── API Functions ──
async function fetchGuilds() {
    try {
        const guilds = await fetchWithRetry('/api/guilds');
        guildList.innerHTML = '';
        guilds.forEach(guild => {
            const div = document.createElement('div');
            div.className = 'guild-icon';
            div.title = guild.name;
            div.innerHTML = guild.icon ? `<img src="${guild.icon}" alt="${guild.name}">` : `<span>${guild.name.charAt(0)}</span>`;
            div.addEventListener('click', () => selectGuild(guild.id, guild.name, div));
            guildList.appendChild(div);
        });
    } catch (error) { showNotification('โหลดเซิร์ฟเวอร์ไม่สำเร็จเมี๊ยว 😿'); }
}

async function selectGuild(guildId, guildName, element) {
    currentGuildId = guildId;
    currentGuildName.textContent = guildName;
    document.querySelectorAll('.guild-icon').forEach(el => el.classList.remove('active'));
    element.classList.add('active');
    if (currentChannelId) socket.emit('leave_channel', currentChannelId);
    currentChannelId = null;
    currentChannelName.textContent = 'ยังไม่ได้เลือกห้อง';
    messageInput.disabled = true;
    sendBtn.disabled = true;
    messageLog.innerHTML = '<div class="welcome-container"><h3>กรุณาเลือกห้องแชทเมี๊ยว 🐾</h3></div>';
    fetchChannels(guildId);
    fetchCharacters(guildId);
    fetchMembers(guildId);
}

async function fetchChannels(guildId, silent = false) {
    try {
        if (!silent) channelList.innerHTML = '<div class="empty-state">กำลังโหลดห้อง...</div>';
        const data = await fetchWithRetry(`/api/channels/${guildId}`);
        renderChannels(data);
    } catch (error) { if (!silent) showNotification('โหลดห้องไม่สำเร็จเมี๊ยว 😿'); }
}

function renderChannels(channels) {
    const activeId = currentChannelId;
    channelList.innerHTML = '';
    channels.forEach(channel => {
        const isVoice = channel.type === 2;
        const div = document.createElement('div');
        div.className = `channel-item ${activeId === channel.id ? 'active' : ''}`;
        div.innerHTML = `<i class="fa-solid ${isVoice ? 'fa-volume-high' : 'fa-hashtag'}"></i> ${channel.name}`;
        if (!isVoice) div.addEventListener('click', () => selectChannel(channel.id, channel.name, div));
        channelList.appendChild(div);
        if (isVoice && channel.members && channel.members.length > 0) {
            const membersDiv = document.createElement('div');
            membersDiv.className = 'voice-members';
            channel.members.forEach(m => {
                const mDiv = document.createElement('div');
                mDiv.className = 'voice-member';
                mDiv.innerHTML = `<img src="${m.avatar}" alt="${m.displayName}"><span>${m.displayName}</span>`;
                membersDiv.appendChild(mDiv);
            });
            channelList.appendChild(membersDiv);
        }
    });
}

function selectChannel(channelId, channelName, element) {
    if (currentChannelId) socket.emit('leave_channel', currentChannelId);
    currentChannelId = channelId;
    currentChannelName.textContent = channelName;
    document.querySelectorAll('.channel-item').forEach(el => el.classList.remove('active'));
    element.classList.add('active');
    messageInput.disabled = false;
    sendBtn.disabled = false;
    messageInput.placeholder = `ส่งข้อความถึง #${channelName}`;
    messageInput.focus();
    socket.emit('join_channel', channelId);
    const cached = messageCache[channelId];
    if (cached && (Date.now() - cached.lastFetched < 30000)) {
        renderMessages(cached.messages);
        fetchMessages(currentGuildId, channelId, true);
    } else { fetchMessages(currentGuildId, channelId); }
}

async function fetchMessages(guildId, channelId, background = false) {
    try {
        if (!background) messageLog.innerHTML = '<div class="empty-state">กำลังดึงประวัติการแชท...</div>';
        const messages = await fetchWithRetry(`/api/messages/${guildId}/${channelId}`);
        messageCache[channelId] = { messages: messages, lastFetched: Date.now() };
        renderMessages(messages);
    } catch (error) { if (!background) showNotification('โหลดประวัติไม่สำเร็จเมี๊ยว 😿'); }
}

function renderMessages(messages) {
    messageLog.innerHTML = '';
    if (messages.length === 0) { messageLog.innerHTML = '<div class="empty-state">ยังไม่มีข้อความในห้องนี้เมี๊ยว</div>'; return; }
    messages.forEach(msg => appendMessage(msg, false));
    messageLog.scrollTop = messageLog.scrollHeight;
}

function appendMessage(msg, scroll = true) {
    const item = document.createElement('div');
    item.className = 'message-item';
    const date = new Date(msg.timestamp);
    const day = String(date.getDate()).padStart(2, '0');
    const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][date.getMonth()];
    const year = date.getFullYear();
    const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const formattedDate = `${day}-${month}-${year} ${time}`;
    let attachmentsHtml = msg.attachments && msg.attachments.length > 0 ? `<div class="message-attachments">${msg.attachments.map(a => `<img class="message-image" src="${a.url}" alt="${a.name}" onclick="window.open('${a.url}')">`).join('')}</div>` : '';
    let embedsHtml = msg.embeds && msg.embeds.length > 0 ? msg.embeds.map(e => `<div class="message-embed" style="border-left-color: ${e.color ? '#' + e.color.toString(16).padStart(6, '0') : 'var(--accent)'}">${e.title ? `<a href="${e.url || '#'}" class="embed-title">${e.title}</a>` : ''}${e.description ? `<div class="embed-description">${formatContent(e.description)}</div>` : ''}${e.fields && e.fields.length > 0 ? `<div class="embed-fields">${e.fields.map(f => `<div class="embed-field"><div class="embed-field-name">${f.name}</div><div class="embed-field-value">${formatContent(f.value)}</div></div>`).join('')}</div>` : ''}${e.image ? `<img src="${e.image}" class="embed-image" onclick="window.open('${e.image}')">` : ''}${e.footer ? `<div class="embed-footer">${e.footer}</div>` : ''}</div>`).join('') : '';
    item.innerHTML = `<img class="message-avatar" src="${msg.author.avatar}" alt="Avatar"><div class="message-content-wrapper"><div class="message-author"><span class="name">${msg.author.name}</span>${msg.author.isBot ? '<span class="bot-tag">BOT</span>' : ''}<span class="time">${formattedDate}</span></div>${msg.content ? `<div class="message-text">${formatContent(msg.content)}</div>` : ''}${attachmentsHtml}${embedsHtml}</div>`;
    messageLog.appendChild(item);
    if (scroll) messageLog.scrollTop = messageLog.scrollHeight;
}

function formatContent(content) {
    const mentionRegex = /(@[^\s]+)/g;
    let formatted = content.replace(mentionRegex, '<span class="mention-text">$1</span>');
    return formatted.replace(/\n/g, '<br>');
}

// ── File Upload Logic ──
triggerUpload.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => { const files = Array.from(e.target.files); selectedFiles = [...selectedFiles, ...files]; renderPreviews(); fileInput.value = ''; });
function renderPreviews() {
    if (selectedFiles.length === 0) { attachmentPreviews.classList.add('d-none'); attachmentPreviews.innerHTML = ''; return; }
    attachmentPreviews.classList.remove('d-none');
    attachmentPreviews.innerHTML = '';
    selectedFiles.forEach((file, index) => {
        const reader = new FileReader();
        const div = document.createElement('div');
        div.className = 'preview-item';
        reader.onload = (e) => { div.innerHTML = `<img src="${e.target.result}" alt="${file.name}"><span class="file-name">${file.name}</span><div class="remove-preview" onclick="removeFile(${index})"><i class="fa-solid fa-xmark"></i></div>`; };
        reader.readAsDataURL(file);
        attachmentPreviews.appendChild(div);
    });
}
window.removeFile = (index) => { selectedFiles.splice(index, 1); renderPreviews(); };

// ── Mention Autocomplete Logic ──
messageInput.addEventListener('input', (e) => {
    const value = e.target.value;
    const cursorPosition = e.target.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPosition);
    const lastAtSymbol = textBeforeCursor.lastIndexOf('@');
    if (lastAtSymbol !== -1 && !/\s/.test(textBeforeCursor.substring(lastAtSymbol + 1))) {
        mentionSearchQuery = textBeforeCursor.substring(lastAtSymbol + 1).toLowerCase();
        renderMentionAutocomplete();
    } else { hideMentionAutocomplete(); }
});

function renderMentionAutocomplete() {
    const filtered = mentionableItems.filter(m => m.name.toLowerCase().includes(mentionSearchQuery));
    if (filtered.length === 0) return hideMentionAutocomplete();
    mentionAutocomplete.classList.remove('d-none');
    mentionAutocomplete.innerHTML = '';
    filtered.slice(0, 10).forEach((item, index) => {
        const div = document.createElement('div');
        div.className = `mention-item ${index === selectedMentionIndex ? 'selected' : ''}`;
        let iconHtml = '';
        if (item.type === 'member') iconHtml = `<img src="${item.avatar}" alt="${item.name}">`;
        else if (item.type === 'role') iconHtml = `<div class="role-icon" style="background-color: ${item.color || '#fff'}"></div>`;
        else iconHtml = `<div class="special-icon"><i class="fa-solid fa-bullhorn"></i></div>`;
        div.innerHTML = `${iconHtml}<span class="name" style="color: ${item.color || 'var(--text-primary)'}">${item.name}</span>`;
        div.addEventListener('click', () => insertMention(item.name));
        mentionAutocomplete.appendChild(div);
    });
}
function hideMentionAutocomplete() { mentionAutocomplete.classList.add('d-none'); selectedMentionIndex = 0; }
function insertMention(name) {
    const value = messageInput.value;
    const cursorPosition = messageInput.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPosition);
    const textAfterCursor = value.substring(cursorPosition);
    const lastAtSymbol = textBeforeCursor.lastIndexOf('@');
    const newValue = textBeforeCursor.substring(0, lastAtSymbol) + '@' + name + ' ' + textAfterCursor;
    messageInput.value = newValue;
    hideMentionAutocomplete();
    messageInput.focus();
}

messageInput.addEventListener('keydown', (e) => {
    if (!mentionAutocomplete.classList.contains('d-none')) {
        const items = mentionAutocomplete.querySelectorAll('.mention-item');
        if (e.key === 'ArrowDown') { e.preventDefault(); selectedMentionIndex = (selectedMentionIndex + 1) % items.length; renderMentionAutocomplete(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); selectedMentionIndex = (selectedMentionIndex - 1 + items.length) % items.length; renderMentionAutocomplete(); }
        else if (e.key === 'Enter') { e.preventDefault(); const selectedItem = items[selectedMentionIndex]; if (selectedItem) selectedItem.click(); }
        else if (e.key === 'Escape') { hideMentionAutocomplete(); }
    }
});

// ── Send Message ──
async function sendMessage() {
    let message = messageInput.value.trim();
    if (!message && selectedFiles.length === 0) return;
    if (!currentGuildId || !currentChannelId) return;

    // Convert @Name to <@ID> or <@&ID> before sending
    mentionableItems.forEach(item => {
        if (item.type === 'member') {
            const regex = new RegExp(`@${item.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
            message = message.replace(regex, `<@${item.id}>`);
        } else if (item.type === 'role') {
            const regex = new RegExp(`@${item.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
            message = message.replace(regex, `<@&${item.id}>`);
        }
    });

    sendBtn.disabled = true;
    const formData = new FormData();
    formData.append('guildId', currentGuildId);
    formData.append('channelId', currentChannelId);
    formData.append('characterId', selectedCharacterId || '');
    formData.append('message', message);
    selectedFiles.forEach(file => formData.append('files', file));
    try {
        const result = await fetchWithRetry('/api/speak', { method: 'POST', body: formData });
        if (result.success) { messageInput.value = ''; selectedFiles = []; renderPreviews(); showNotification('ส่งข้อความสำเร็จแล้วเมี๊ยวว! ✨'); }
    } catch (error) { showNotification(`เกิดข้อผิดพลาด: ${error.message}`); } finally { sendBtn.disabled = false; messageInput.focus(); }
}

// ── Characters & Members Logic ──
async function fetchCharacters(guildId) { try { const data = await fetchWithRetry(`/api/characters/${guildId}`); characters = data; renderCharacterGrid(); } catch (error) { console.error(error); } }
function renderCharacterGrid() {
    charGrid.innerHTML = '';
    const defaultCard = document.createElement('div');
    defaultCard.className = `char-card ${!selectedCharacterId ? 'active' : ''}`;
    defaultCard.innerHTML = `<img src="https://cdn.discordapp.com/embed/avatars/0.png" alt="Default"><span>บอทหลัก (Default)</span>`;
    defaultCard.onclick = () => selectCharacter(null);
    charGrid.appendChild(defaultCard);
    characters.forEach(char => {
        const div = document.createElement('div'); div.className = `char-card ${selectedCharacterId === char.id ? 'active' : ''}`;
        div.innerHTML = `<img src="${char.image_url || 'https://cdn.discordapp.com/embed/avatars/0.png'}" alt="${char.name}"><span>${char.name}</span>`;
        div.addEventListener('click', () => selectCharacter(char));
        charGrid.appendChild(div);
    });
    const addCard = document.createElement('div'); addCard.className = 'char-card add-card'; addCard.innerHTML = `<i class="fa-solid fa-plus"></i><span>เพิ่มบทบาทใหม่</span>`; addCard.onclick = openCreateView; charGrid.appendChild(addCard);
}
function selectCharacter(char) {
    if (!char) { selectedCharacterId = null; currentCharAvatar.src = 'https://cdn.discordapp.com/embed/avatars/0.png'; }
    else { selectedCharacterId = char.id; currentCharAvatar.src = char.image_url || 'https://cdn.discordapp.com/embed/avatars/0.png'; }
    renderCharacterGrid(); closeModal();
}
function openCreateView() { charSelectionView.classList.add('d-none'); charCreateView.classList.remove('d-none'); modalTitle.textContent = 'สร้างตัวละครใหม่'; }
function showSelectionView() { charCreateView.classList.add('d-none'); charSelectionView.classList.remove('d-none'); modalTitle.textContent = 'เลือกตัวละครที่จะสวมบทบาท'; }
openModalBtn.addEventListener('click', () => { if (!currentGuildId) return showNotification('กรุณาเลือกเซิร์ฟเวอร์ก่อนเมี๊ยว!'); charModal.classList.remove('hidden'); showSelectionView(); });
closeModalBtn.addEventListener('click', closeModal); backToSelectionBtn.addEventListener('click', showSelectionView); charModal.addEventListener('click', (e) => { if (e.target === charModal) closeModal(); });
function closeModal() { charModal.classList.add('hidden'); }
createCharForm.addEventListener('submit', async (e) => {
    e.preventDefault(); const name = document.getElementById('new-char-name').value, url = document.getElementById('new-char-url').value, persona = document.getElementById('new-char-persona').value;
    try { const result = await fetchWithRetry('/api/characters', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ guildId: currentGuildId, name, imageUrl: url, persona }) }); if (result) { showNotification('สร้างตัวละครสำเร็จแล้วเมี๊ยว! ✨'); createCharForm.reset(); fetchCharacters(currentGuildId); showSelectionView(); } } catch (error) { showNotification('เกิดข้อผิดพลาดในการสร้างตัวละคร 😿'); }
});

async function fetchMembers(guildId) {
    try {
        memberList.innerHTML = '<div class="empty-state">กำลังโหลดสมาชิก...</div>';
        const data = await fetchWithRetry(`/api/members/${guildId}`);
        mentionableItems = [{ id: 'everyone', name: 'everyone', type: 'special', color: '#fff' }, { id: 'here', name: 'here', type: 'special', color: '#fff' }];
        data.roles.forEach(r => mentionableItems.push({ id: r.id, name: r.name, color: r.color, type: 'role' }));
        const members = data.groups.flatMap(g => g.members);
        members.forEach(m => mentionableItems.push({ id: m.id, name: m.displayName, avatar: m.avatar, color: m.color, type: 'member' }));
        renderMembers(data.groups);
    } catch (error) { showNotification('โหลดสมาชิกไม่สำเร็จเมี๊ยว 😿'); }
}
function renderMembers(groups) {
    memberList.innerHTML = '';
    groups.forEach(group => {
        const header = document.createElement('div'); header.className = 'role-header'; header.textContent = `${group.roleName} — ${group.members.length}`; memberList.appendChild(header);
        group.members.forEach(member => {
            const div = document.createElement('div'); div.className = 'member-item';
            div.innerHTML = `<div class="member-avatar-wrapper"><img src="${member.avatar}" alt="${member.displayName}"><div class="status-dot status-${member.status}"></div></div><span class="member-name" style="color: ${member.color || 'var(--text-muted)'}">${member.displayName}</span>`;
            memberList.appendChild(div);
        });
    });
}

// ── UI Events ──
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && mentionAutocomplete.classList.contains('d-none')) { e.preventDefault(); sendMessage(); } });
function showNotification(text) { const notification = document.getElementById('notification'); notification.textContent = text; notification.classList.remove('hidden'); setTimeout(() => { notification.classList.add('hidden'); }, 3000); }
