/* ==========================================================================
   Pulse · 应用逻辑
   仅依赖浏览器原生 API，无框架、无构建
   ========================================================================== */

(function () {
  'use strict';

  /* ------------------------------ 常量与元素 ------------------------------ */

  var STORAGE_KEY = 'pulse.timeline.v1';
  var MAX_LENGTH = 280;
  var TIME_REFRESH_MS = 60000;
  var AUTHOR = { name: '本地用户', initial: '你' };

  var els = {
    form: document.getElementById('composer-form'),
    input: document.getElementById('composer-input'),
    hint: document.getElementById('composer-hint'),
    counter: document.getElementById('char-counter'),
    used: document.getElementById('char-used'),
    max: document.getElementById('char-max'),
    publish: document.getElementById('publish-btn'),
    feed: document.getElementById('feed'),
    postCount: document.getElementById('post-count'),
    empty: document.getElementById('empty-state')
  };

  /** 内存中的动态列表，始终保持「新 → 旧」顺序 */
  var posts = [];

  /* ------------------------------ 存储层 ------------------------------ */

  function createId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function isValidPost(item) {
    return (
      item &&
      typeof item === 'object' &&
      typeof item.content === 'string' &&
      item.content.trim() !== '' &&
      typeof item.createdAt === 'number' &&
      isFinite(item.createdAt)
    );
  }

  /**
   * 读取本地数据；任何异常或结构不合法都安全回退为空列表。
   */
  function loadPosts() {
    var raw = null;
    try {
      raw = window.localStorage.getItem(STORAGE_KEY);
    } catch (err) {
      console.warn('[Pulse] 无法读取本地存储:', err);
      return [];
    }
    if (!raw) {
      return [];
    }
    try {
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed
        .filter(isValidPost)
        .map(function (item) {
          return {
            id: typeof item.id === 'string' && item.id ? item.id : createId(),
            content: item.content,
            createdAt: item.createdAt
          };
        })
        .sort(function (a, b) {
          return b.createdAt - a.createdAt;
        });
    } catch (err) {
      console.warn('[Pulse] 本地数据已损坏，已忽略:', err);
      return [];
    }
  }

  /**
   * 写入本地数据，返回是否成功（配额超限等情况会失败）。
   */
  function savePosts(list) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      return true;
    } catch (err) {
      console.warn('[Pulse] 保存到本地存储失败:', err);
      return false;
    }
  }

  /* ------------------------------ 渲染层 ------------------------------ */

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function formatTime(timestamp, now) {
    var diff = now - timestamp;
    if (diff < 60 * 1000) {
      return '刚刚';
    }
    var minutes = Math.floor(diff / (60 * 1000));
    if (minutes < 60) {
      return minutes + ' 分钟前';
    }
    var hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return hours + ' 小时前';
    }
    var days = Math.floor(hours / 24);
    if (days < 7) {
      return days + ' 天前';
    }
    var date = new Date(timestamp);
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  }

  /**
   * 用 DOM API 构建单条动态，正文通过 textContent 写入，避免注入风险。
   */
  function createPostNode(post) {
    var article = document.createElement('article');
    article.className = 'post';
    article.dataset.id = post.id;

    var avatar = document.createElement('span');
    avatar.className = 'avatar';
    avatar.textContent = AUTHOR.initial;
    avatar.setAttribute('aria-hidden', 'true');

    var body = document.createElement('div');
    body.className = 'post__body';

    var head = document.createElement('div');
    head.className = 'post__head';

    var name = document.createElement('span');
    name.className = 'post__name';
    name.textContent = AUTHOR.name;

    var time = document.createElement('time');
    time.className = 'post__time';
    time.dataset.ts = String(post.createdAt);
    time.dateTime = new Date(post.createdAt).toISOString();
    time.textContent = formatTime(post.createdAt, Date.now());

    head.appendChild(name);
    head.appendChild(time);

    var text = document.createElement('p');
    text.className = 'post__text';
    text.textContent = post.content;

    body.appendChild(head);
    body.appendChild(text);
    article.appendChild(avatar);
    article.appendChild(body);

    return article;
  }

  function renderTimeline() {
    var fragment = document.createDocumentFragment();
    posts.forEach(function (post) {
      fragment.appendChild(createPostNode(post));
    });
    els.feed.replaceChildren(fragment);
    updateMeta();
  }

  function updateMeta() {
    els.postCount.textContent = posts.length + ' 条动态';
    els.empty.hidden = posts.length > 0;
    els.feed.setAttribute('aria-busy', 'false');
  }

  function refreshTimes() {
    var now = Date.now();
    var nodes = els.feed.querySelectorAll('time[data-ts]');
    Array.prototype.forEach.call(nodes, function (node) {
      var ts = Number(node.dataset.ts);
      if (isFinite(ts)) {
        node.textContent = formatTime(ts, now);
      }
    });
  }

  /* ------------------------------ 交互层 ------------------------------ */

  function showHint(message) {
    els.hint.textContent = message;
    els.hint.classList.add('is-visible');
  }

  function clearHint() {
    els.hint.textContent = '';
    els.hint.classList.remove('is-visible');
  }

  function syncComposer() {
    var raw = els.input.value;
    var trimmed = raw.trim();
    var overLimit = trimmed.length > MAX_LENGTH;

    els.used.textContent = String(raw.length);
    els.counter.classList.toggle('is-over', overLimit);
    els.publish.disabled = trimmed.length === 0 || overLimit;
  }

  function handleSubmit(event) {
    event.preventDefault();

    var content = els.input.value.trim();

    if (!content) {
      showHint('写点什么再发布吧');
      els.input.focus();
      return;
    }

    if (content.length > MAX_LENGTH) {
      showHint('内容超出 ' + MAX_LENGTH + ' 字上限，请删减后再发布');
      els.input.focus();
      return;
    }

    var post = { id: createId(), content: content, createdAt: Date.now() };
    posts.unshift(post);

    var saved = savePosts(posts);

    els.feed.prepend(createPostNode(post));
    els.input.value = '';
    clearHint();
    syncComposer();
    updateMeta();
    els.input.focus();
    els.input.scrollTop = 0;

    var first = els.feed.firstElementChild;
    if (first && typeof first.scrollIntoView === 'function') {
      first.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    if (!saved) {
      showHint('本地存储写入失败，本条动态仅在本次会话可见');
    }
  }

  /**
   * 跨标签页同步：其它窗口修改了数据时重新加载。
   */
  function handleStorageEvent(event) {
    if (event.key !== null && event.key !== STORAGE_KEY) {
      return;
    }
    posts = loadPosts();
    renderTimeline();
  }

  function init() {
    els.max.textContent = String(MAX_LENGTH);
    posts = loadPosts();
    renderTimeline();
    syncComposer();
    clearHint();

    els.input.addEventListener('input', function () {
      clearHint();
      syncComposer();
    });

    els.form.addEventListener('submit', handleSubmit);

    window.addEventListener('storage', handleStorageEvent);
    window.setInterval(refreshTimes, TIME_REFRESH_MS);
  }

  init();
})();
