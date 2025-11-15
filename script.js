const CONFIG = {
  ANILIST_API_KEY: 'cdf9b6a0255cebc133ce4d9aaaee8d6d',
  BASE_URL: 'https://graphql.anilist.co',
  IMG_BASE_URL: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/',
  MAX_RETRIES: 3,
  INITIAL_DELAY: 1000,
  CACHE_DURATION: 15 * 60 * 1000,
  ACCESS_CODE: 'ANIME2025'
};

const State = {
  currentType: 'shonen',
  currentAbortController: null,
  isLoading: false,
  lastItem: null,
  cache: {},
  cacheExpiry: {},
  favorites: JSON.parse(localStorage.getItem('anima_favorites')) || [],
  watchlist: JSON.parse(localStorage.getItem('anima_watchlist')) || [],
  history: JSON.parse(localStorage.getItem('anima_history')) || [],
  settings: JSON.parse(localStorage.getItem('anima_settings')) || {
    theme: 'sakura',
    contentQuality: 'balanced',
    includeAniList: true
  },
  isOnline: navigator.onLine
};

function setupAccessModal() {
  const accessModal = document.getElementById('access-modal');
  const accessCodeInput = document.getElementById('access-code');
  const submitButton = document.getElementById('submit-code');
  const errorMessage = document.getElementById('error-message');
  
  const hasAccess = localStorage.getItem('anima_access_granted');
  if (hasAccess === 'true') {
    accessModal.classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');
    return;
  }
  
  submitButton.addEventListener('click', () => {
    const enteredCode = accessCodeInput.value.trim();
    
    if (enteredCode === CONFIG.ACCESS_CODE) {
      localStorage.setItem('anima_access_granted', 'true');
      accessModal.classList.add('hidden');
      document.getElementById('main-app').classList.remove('hidden');
      showNotification('¡Bienvenido a TV ANIMA!');
    } else {
      errorMessage.classList.remove('hidden');
      accessCodeInput.value = '';
      accessCodeInput.focus();
    }
  });
  
  accessCodeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      submitButton.click();
    }
  });
}

function setupTheme() {
  const savedTheme = State.settings.theme;
  applyTheme(savedTheme);
  
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }
  
  const themeRadios = document.querySelectorAll('input[name="theme"]');
  themeRadios.forEach(radio => {
    radio.checked = radio.value === savedTheme;
    radio.addEventListener('change', (e) => {
      applyTheme(e.target.value);
      saveSettings();
    });
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  State.settings.theme = theme;
  updateThemeIcon(theme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'sakura' ? 'midnight' : 'sakura';
  
  applyTheme(newTheme);
  
  const themeRadios = document.querySelectorAll('input[name="theme"]');
  themeRadios.forEach(radio => {
    radio.checked = radio.value === newTheme;
  });
  
  saveSettings();
  showNotification(`Tema cambiado a ${newTheme === 'sakura' ? 'Sakura' : 'Medianoche'}`);
}

function updateThemeIcon(theme) {
  const themeIcon = document.querySelector('.theme-icon');
  if (themeIcon) {
    themeIcon.textContent = theme === 'sakura' ? '🌸' : '🌙';
  }
}

function setupSettings() {
  const contentQuality = document.getElementById('content-quality');
  if (contentQuality) {
    contentQuality.value = State.settings.contentQuality;
    contentQuality.addEventListener('change', saveSettings);
  }
  
  const anilistToggle = document.getElementById('anilist-toggle');
  if (anilistToggle) {
    anilistToggle.checked = State.settings.includeAniList;
    anilistToggle.addEventListener('change', saveSettings);
  }
}

function saveSettings() {
  State.settings = {
    theme: document.querySelector('input[name="theme"]:checked')?.value || 'sakura',
    contentQuality: document.getElementById('content-quality')?.value || 'balanced',
    includeAniList: document.getElementById('anilist-toggle')?.checked || true
  };
  
  localStorage.setItem('anima_settings', JSON.stringify(State.settings));
  applyTheme(State.settings.theme);
}

function setupNavigation() {
  const menuBtn = document.getElementById('menu-btn');
  const sideMenu = document.getElementById('side-menu');
  const closeMenu = document.getElementById('close-menu');
  
  if (menuBtn && sideMenu) {
    menuBtn.addEventListener('click', () => {
      sideMenu.classList.add('open');
    });
  }
  
  if (closeMenu && sideMenu) {
    closeMenu.addEventListener('click', () => {
      sideMenu.classList.remove('open');
    });
  }
  
  const menuItems = document.querySelectorAll('.menu-item');
  menuItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const section = item.dataset.section;
      
      menuItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      
      showSection(section);
      sideMenu.classList.remove('open');
    });
  });
}

function showSection(sectionId) {
  const sections = document.querySelectorAll('.content-section');
  sections.forEach(section => section.classList.remove('active'));
  
  const targetSection = document.getElementById(sectionId);
  if (targetSection) {
    targetSection.classList.add('active');
    
    if (sectionId === 'favorites') {
      loadFavorites();
    } else if (sectionId === 'watchlist') {
      loadWatchlist();
    } else if (sectionId === 'history') {
      loadHistory();
    }
  }
}

function setupFavorites() {
  const favoriteBtn = document.getElementById('favorite-btn');
  if (favoriteBtn) {
    favoriteBtn.addEventListener('click', toggleFavorite);
  }
  
  updateStats();
}

function toggleFavorite() {
  if (!State.lastItem) return;
  
  const item = State.lastItem.item;
  const existingIndex = State.favorites.findIndex(fav => 
    fav.id === item.id
  );
  
  if (existingIndex >= 0) {
    State.favorites.splice(existingIndex, 1);
    showNotification('Eliminado de favoritos');
  } else {
    State.favorites.push({
      ...item,
      added_at: new Date().toISOString()
    });
    showNotification('Añadido a favoritos');
  }
  
  localStorage.setItem('anima_favorites', JSON.stringify(State.favorites));
  updateFavoriteButton();
  updateStats();
}

function updateFavoriteButton() {
  const favoriteBtn = document.getElementById('favorite-btn');
  if (!favoriteBtn || !State.lastItem) return;
  
  const item = State.lastItem.item;
  const isFavorite = State.favorites.some(fav => 
    fav.id === item.id
  );
  
  favoriteBtn.innerHTML = isFavorite ? 
    '<span class="action-icon">💔</span> Quitar Favorito' :
    '<span class="action-icon">❤️</span> Favorito';
}

function loadFavorites() {
  const grid = document.getElementById('favorites-grid');
  if (!grid) return;
  
  if (State.favorites.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">❤️</span>
        <h3>No hay favoritos aún</h3>
        <p>Los animes que marques como favoritos aparecerán aquí</p>
      </div>
    `;
    return;
  }
  
  grid.innerHTML = State.favorites.map(item => `
    <div class="grid-item" data-id="${item.id}" data-source="${item.source || 'anilist'}">
      <img src="${item.coverImage?.large || item.poster_path}" 
           alt="${item.title?.romaji || item.title?.english || item.name}" 
           class="grid-poster"
           onerror="this.src='https://via.placeholder.com/200x300/1a1a25/6c757d?text=Sin+imagen'">
      <div class="grid-info">
        <div class="grid-title">${item.title?.romaji || item.title?.english || item.name}</div>
        <div class="grid-year">${item.startDate?.year || item.year || 'N/A'}</div>
      </div>
    </div>
  `).join('');
}

function setupWatchlist() {
  const watchlistBtn = document.getElementById('watchlist-btn');
  if (watchlistBtn) {
    watchlistBtn.addEventListener('click', toggleWatchlist);
  }
}

function toggleWatchlist() {
  if (!State.lastItem) return;
  
  const item = State.lastItem.item;
  const existingIndex = State.watchlist.findIndex(watch => 
    watch.id === item.id
  );
  
  if (existingIndex >= 0) {
    State.watchlist.splice(existingIndex, 1);
    showNotification('Eliminado de la lista');
  } else {
    State.watchlist.push({
      ...item,
      added_at: new Date().toISOString()
    });
    showNotification('Añadido a por ver');
  }
  
  localStorage.setItem('anima_watchlist', JSON.stringify(State.watchlist));
  updateWatchlistButton();
  updateStats();
}

function updateWatchlistButton() {
  const watchlistBtn = document.getElementById('watchlist-btn');
  if (!watchlistBtn || !State.lastItem) return;
  
  const item = State.lastItem.item;
  const inWatchlist = State.watchlist.some(watch => 
    watch.id === item.id
  );
  
  watchlistBtn.innerHTML = inWatchlist ? 
    '<span class="action-icon">✅</span> En Lista' :
    '<span class="action-icon">📝</span> Por Ver';
}

function loadWatchlist() {
  const grid = document.getElementById('watchlist-grid');
  if (!grid) return;
  
  if (State.watchlist.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">📝</span>
        <h3>Lista vacía</h3>
        <p>Agrega anime a tu lista para verlo después</p>
      </div>
    `;
    return;
  }
  
  grid.innerHTML = State.watchlist.map(item => `
    <div class="grid-item" data-id="${item.id}" data-source="${item.source || 'anilist'}">
      <img src="${item.coverImage?.large || item.poster_path}" 
           alt="${item.title?.romaji || item.title?.english || item.name}" 
           class="grid-poster"
           onerror="this.src='https://via.placeholder.com/200x300/1a1a25/6c757d?text=Sin+imagen'">
      <div class="grid-info">
        <div class="grid-title">${item.title?.romaji || item.title?.english || item.name}</div>
        <div class="grid-year">${item.startDate?.year || item.year || 'N/A'}</div>
      </div>
    </div>
  `).join('');
}

function addToHistory(item, action = 'viewed') {
  State.history.unshift({
    ...item,
    action,
    timestamp: new Date().toISOString()
  });
  
  State.history = State.history.slice(0, 50);
  localStorage.setItem('anima_history', JSON.stringify(State.history));
}

function loadHistory() {
  const historyList = document.getElementById('history-list');
  if (!historyList) return;
  
  if (State.history.length === 0) {
    historyList.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">🕒</span>
        <h3>Sin historial</h3>
        <p>Tu actividad aparecerá aquí</p>
      </div>
    `;
    return;
  }
  
  historyList.innerHTML = State.history.map(item => `
    <div class="history-item">
      <div class="history-content">
        <strong>${item.title?.romaji || item.title?.english || item.name}</strong>
        <span class="history-action">${getActionText(item.action)}</span>
        <span class="history-time">${formatRelativeTime(item.timestamp)}</span>
      </div>
    </div>
  `).join('');
}

function getActionText(action) {
  const actions = {
    viewed: 'visto',
    favorited: 'agregado a favoritos',
    watchlisted: 'agregado a por ver'
  };
  return actions[action] || action;
}

function formatRelativeTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'ahora mismo';
  if (minutes < 60) return `hace ${minutes} min`;
  if (hours < 24) return `hace ${hours} h`;
  if (days < 7) return `hace ${days} d`;
  
  return date.toLocaleDateString('es-ES');
}

function updateStats() {
  const favCount = document.getElementById('fav-count');
  const watchCount = document.getElementById('watch-count');
  
  if (favCount) favCount.textContent = State.favorites.length;
  if (watchCount) watchCount.textContent = State.watchlist.length;
}

function showNotification(message, duration = 3000) {
  const notification = document.getElementById('notification');
  const notificationText = document.getElementById('notification-text');
  
  if (!notification || !notificationText) return;
  
  notificationText.textContent = message;
  notification.classList.add('show');
  
  setTimeout(() => {
    notification.classList.remove('show');
  }, duration);
}

function setupNotifications() {
  const closeBtn = document.getElementById('notification-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      document.getElementById('notification').classList.remove('show');
    });
  }
}

function setupNetworkStatus() {
  window.addEventListener('online', () => {
    State.isOnline = true;
    showNotification('Conexión restaurada', 2000);
  });
  
  window.addEventListener('offline', () => {
    State.isOnline = false;
    showNotification('Sin conexión', 4000);
  });
}

function cleanup() {
  if (State.currentAbortController) {
    State.currentAbortController.abort();
    State.currentAbortController = null;
  }
}

async function fetchWithRetry(query, variables = {}, retries = CONFIG.MAX_RETRIES, delay = CONFIG.INITIAL_DELAY) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(CONFIG.BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          query: query,
          variables: variables
        }),
        signal: State.currentAbortController?.signal
      });
      
      if (!res.ok) {
        if (res.status === 429 && i < retries) {
          await new Promise(r => setTimeout(r, delay * (2 ** i)));
          continue;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      
      const data = await res.json();
      
      if (data.errors) {
        throw new Error(data.errors[0].message);
      }
      
      return data.data;
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      if (i === retries) throw err;
      await new Promise(r => setTimeout(r, delay * (2 ** i)));
    }
  }
}

async function fetchAnimeByGenre(genre, sort = "POPULARITY_DESC") {
  const query = `
    query ($genre: String, $sort: [MediaSort]) {
      Page(page: 1, perPage: 50) {
        media(type: ANIME, genre: $genre, sort: $sort) {
          id
          title {
            romaji
            english
            native
          }
          description
          startDate {
            year
            month
            day
          }
          endDate {
            year
            month
            day
          }
          coverImage {
            large
            medium
          }
          bannerImage
          episodes
          genres
          averageScore
          popularity
          status
          format
        }
      }
    }
  `;
  
  const variables = {
    genre: genre,
    sort: sort
  };
  
  const data = await fetchWithRetry(query, variables);
  return data.Page.media;
}

async function fetchAnimeByStatus(status, sort = "POPULARITY_DESC") {
  const query = `
    query ($status: MediaStatus, $sort: [MediaSort]) {
      Page(page: 1, perPage: 50) {
        media(type: ANIME, status: $status, sort: $sort) {
          id
          title {
            romaji
            english
            native
          }
          description
          startDate {
            year
            month
            day
          }
          endDate {
            year
            month
            day
          }
          coverImage {
            large
            medium
          }
          bannerImage
          episodes
          genres
          averageScore
          popularity
          status
          format
        }
      }
    }
  `;
  
  const variables = {
    status: status,
    sort: sort
  };
  
  const data = await fetchWithRetry(query, variables);
  return data.Page.media;
}

async function fetchTrendingAnime() {
  const query = `
    query {
      Page(page: 1, perPage: 50) {
        media(type: ANIME, sort: TRENDING_DESC) {
          id
          title {
            romaji
            english
            native
          }
          description
          startDate {
            year
            month
            day
          }
          endDate {
            year
            month
            day
          }
          coverImage {
            large
            medium
          }
          bannerImage
          episodes
          genres
          averageScore
          popularity
          status
          format
        }
      }
    }
  `;
  
  const data = await fetchWithRetry(query);
  return data.Page.media;
}

async function fetchPopularAnime() {
  const query = `
    query {
      Page(page: 1, perPage: 50) {
        media(type: ANIME, sort: POPULARITY_DESC) {
          id
          title {
            romaji
            english
            native
          }
          description
          startDate {
            year
            month
            day
          }
          endDate {
            year
            month
            day
          }
          coverImage {
            large
            medium
          }
          bannerImage
          episodes
          genres
          averageScore
          popularity
          status
          format
        }
      }
    }
  `;
  
  const data = await fetchWithRetry(query);
  return data.Page.media;
}

async function fetchTopRatedAnime() {
  const query = `
    query {
      Page(page: 1, perPage: 50) {
        media(type: ANIME, sort: SCORE_DESC) {
          id
          title {
            romaji
            english
            native
          }
          description
          startDate {
            year
            month
            day
          }
          endDate {
            year
            month
            day
          }
          coverImage {
            large
            medium
          }
          bannerImage
          episodes
          genres
          averageScore
          popularity
          status
          format
        }
      }
    }
  `;
  
  const data = await fetchWithRetry(query);
  return data.Page.media;
}

async function fetchContentByType(type) {
  const now = Date.now();
  const cacheValid = State.cache[type]?.length > 0 && now < State.cacheExpiry[type];

  if (cacheValid) {
    return State.cache[type];
  }

  let rawData = [];

  try {
    switch (type) {
      case 'shonen':
        rawData = await fetchAnimeByGenre("Action", "POPULARITY_DESC");
        break;
        
      case 'shojo':
        rawData = await fetchAnimeByGenre("Romance", "POPULARITY_DESC");
        break;
        
      case 'seinen':
        rawData = await fetchAnimeByGenre("Drama", "POPULARITY_DESC");
        break;
        
      case 'josei':
        rawData = await fetchAnimeByGenre("Slice of Life", "POPULARITY_DESC");
        break;
        
      case 'kodomomuke':
        rawData = await fetchAnimeByGenre("Comedy", "POPULARITY_DESC");
        break;

      case 'isekai':
        rawData = await fetchAnimeByGenre("Adventure", "POPULARITY_DESC");
        break;
        
      case 'mecha':
        rawData = await fetchAnimeByGenre("Mecha", "POPULARITY_DESC");
        break;
        
      case 'slice_of_life':
        rawData = await fetchAnimeByGenre("Slice of Life", "POPULARITY_DESC");
        break;
        
      case 'fantasy':
        rawData = await fetchAnimeByGenre("Fantasy", "POPULARITY_DESC");
        break;
        
      case 'sci_fi':
        rawData = await fetchAnimeByGenre("Sci-Fi", "POPULARITY_DESC");
        break;
        
      case 'romance':
        rawData = await fetchAnimeByGenre("Romance", "POPULARITY_DESC");
        break;
        
      case 'comedy':
        rawData = await fetchAnimeByGenre("Comedy", "POPULARITY_DESC");
        break;
        
      case 'horror':
        rawData = await fetchAnimeByGenre("Horror", "POPULARITY_DESC");
        break;

      case 'airing':
        rawData = await fetchAnimeByStatus("RELEASING", "POPULARITY_DESC");
        break;
        
      case 'upcoming':
        rawData = await fetchAnimeByStatus("NOT_YET_RELEASED", "POPULARITY_DESC");
        break;
        
      case 'top_rated':
        rawData = await fetchTopRatedAnime();
        break;
        
      case 'popular':
        rawData = await fetchPopularAnime();
        break;
        
      case 'classics':
        rawData = await fetchAnimeByStatus("FINISHED", "START_DATE_DESC");
        break;
        
      case 'trending':
        rawData = await fetchTrendingAnime();
        break;

      default:
        rawData = await fetchPopularAnime();
    }

    const valid = rawData.filter(item => {
      return item.coverImage && item.coverImage.large && item.title;
    });

    State.cache[type] = valid;
    State.cacheExpiry[type] = now + CONFIG.CACHE_DURATION;

    return valid;
  } catch (error) {
    console.error(`Error fetching anime for ${type}:`, error);
    return State.cache[type] || [];
  }
}

async function getContentByType(type) {
  const items = await fetchContentByType(type);
  if (items.length === 0) {
    throw new Error('No hay anime disponible en esta categoría.');
  }
  
  return items;
}

function renderContent(item) {
  const container = document.getElementById('anime-container');
  if (!container) return;
  
  container.innerHTML = '';

  const img = document.createElement('img');
  img.className = 'anime-poster';
  img.src = item.coverImage.large;
  
  const title = item.title.romaji || item.title.english || item.title.native;
  img.alt = `Póster de ${title}`;
  img.loading = 'lazy';
  img.onerror = () => {
    img.src = 'https://via.placeholder.com/300x450/1a1a25/6c757d?text=Sin+imagen';
    img.alt = 'Imagen no disponible';
  };

  const titleElement = document.createElement('div');
  titleElement.className = 'anime-title';
  const year = item.startDate?.year || 'N/A';
  
  titleElement.textContent = `${title} (${year})`;

  const overview = document.createElement('p');
  overview.className = 'anime-overview';
  overview.textContent = item.description?.replace(/<[^>]*>/g, '') || 'Sin descripción disponible.';

  container.appendChild(img);
  container.appendChild(titleElement);
  
  if (item.episodes) {
    const episodeInfo = document.createElement('div');
    episodeInfo.className = 'episode-info';
    episodeInfo.innerHTML = `
      <strong>Episodios:</strong> ${item.episodes} | 
      <strong>Puntuación:</strong> ${item.averageScore || 'N/A'}%
    `;
    container.appendChild(episodeInfo);
  }
  
  container.appendChild(overview);
  
  State.lastItem = { item, type: State.currentType };
  addToHistory(item, 'viewed');
  updateFavoriteButton();
  updateWatchlistButton();
}

function renderError(message) {
  const container = document.getElementById('anime-container');
  if (!container) return;
  
  container.innerHTML = `
    <div class="error-content">
      <div class="error-icon">⚠️</div>
      <h3>Error al cargar anime</h3>
      <p>${message}</p>
      <button onclick="loadContent()" class="action-btn">
        Reintentar
      </button>
    </div>
  `;
}

async function loadContent() {
  if (State.isLoading) return;
  
  State.isLoading = true;
  cleanup();
  State.currentAbortController = new AbortController();

  const btn = document.getElementById('load-btn');
  const loading = document.getElementById('loading');
  const container = document.getElementById('anime-container');

  if (btn) btn.disabled = true;
  if (loading) loading.style.display = 'flex';
  if (container) container.innerHTML = '';

  try {
    const items = await getContentByType(State.currentType);
    if (items.length > 0) {
      const randomIndex = Math.floor(Math.random() * items.length);
      renderContent(items[randomIndex]);
      showNotification('¡Anime cargado correctamente!');
    } else {
      renderError('No se encontró anime en esta categoría');
    }
  } catch (error) {
    console.error('Error al cargar anime:', error);
    renderError(error.message || 'No se pudo cargar anime. Verifica tu conexión.');
  } finally {
    if (loading) loading.style.display = 'none';
    if (btn) btn.disabled = false;
    State.isLoading = false;
  }
}

function setupFilters() {
  const filterBtns = document.querySelectorAll('.filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.classList.contains('active')) return;
      
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      State.currentType = btn.dataset.type;
      
      loadContent();
      showNotification(`Categoría: ${btn.textContent.trim()}`);
    });
  });
}

function initApp() {
  setupAccessModal();
  setupTheme();
  setupSettings();
  setupNavigation();
  setupFavorites();
  setupWatchlist();
  setupNotifications();
  setupNetworkStatus();
  setupFilters();
  
  const loadBtn = document.getElementById('load-btn');
  if (loadBtn) {
    loadBtn.addEventListener('click', () => loadContent());
  }

  window.addEventListener('beforeunload', cleanup);
}

window.addEventListener('DOMContentLoaded', initApp);

window.toggleFavorite = toggleFavorite;
window.toggleWatchlist = toggleWatchlist;
window.loadContent = loadContent;