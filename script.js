(function() {
  'use strict';

  // === Configuración simplificada ===
  const ACCESS_KEYS = ['CA', 'ANIME2024']; // Nueva clave añadida
  const MAX_ATTEMPTS = 3;
  const LOCK_DURATION = 60000; // 60 segundos de bloqueo

  // === Elementos DOM ===
  const $modal = document.getElementById('authModal');
  const $authForm = document.getElementById('authForm');
  const $keyInput = document.getElementById('accessKey');
  const $submitBtn = document.getElementById('submitBtn');
  const $btnText = $submitBtn.querySelector('.btn-text');
  const $btnLoader = $submitBtn.querySelector('.btn-loader');
  const $feedback = document.getElementById('feedback');
  const $attemptsInfo = document.getElementById('attemptsInfo');
  const $app = document.getElementById('app');
  const $categoryNav = document.getElementById('categoryNav');
  const $grid = document.getElementById('animeGrid');

  // === Estado simplificado ===
  let attemptCount = 0;
  let isLocked = false;
  let lockTimeout = null;
  let currentCategory = 'TRENDING';
  const cache = new Map();

  // === Categorías ===
  const CATEGORIES = [
    { id: 'TRENDING', label: 'Tendencia', sort: 'TRENDING_DESC' },
    { id: 'POPULAR', label: 'Populares', sort: 'POPULARITY_DESC' },
    { id: 'RATING', label: 'Mejor valorados', sort: 'SCORE_DESC' },
    { id: 'UPCOMING', label: 'Próximos', sort: 'POPULARITY_DESC', status: 'NOT_YET_RELEASED' },
    { id: 'AIRING', label: 'En emisión', sort: 'POPULARITY_DESC', status: 'RELEASING' }
  ];

  // === Helpers simplificados ===
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const setLoading = (isLoading) => {
    $submitBtn.disabled = isLoading;
    $btnText.classList.toggle('hidden', isLoading);
    $btnLoader.classList.toggle('hidden', !isLoading);
  };

  const updateAttemptsInfo = () => {
    const remaining = MAX_ATTEMPTS - attemptCount;
    $attemptsInfo.textContent = `Intentos restantes: ${remaining > 0 ? remaining : 0}`;
  };

  // === Validación simplificada ===
  const showMessage = (msg, type = 'error') => {
    $feedback.textContent = msg;
    $feedback.className = `${type}-msg`;
    $keyInput.setAttribute('aria-invalid', type === 'error' ? 'true' : 'false');
  };

  const lockAccess = (duration) => {
    isLocked = true;
    $keyInput.disabled = true;
    $submitBtn.disabled = true;
    
    const endTime = Date.now() + duration;
    
    const updateCountdown = () => {
      const remaining = Math.ceil((endTime - Date.now()) / 1000);
      
      if (remaining <= 0) {
        isLocked = false;
        $keyInput.disabled = false;
        $submitBtn.disabled = false;
        $keyInput.value = '';
        $keyInput.focus();
        showMessage('Puedes intentar nuevamente', 'success');
        attemptCount = 0;
        updateAttemptsInfo();
        return;
      }
      
      showMessage(`Demasiados intentos. Espera ${remaining} segundos.`, 'warning');
      lockTimeout = setTimeout(updateCountdown, 1000);
    };
    
    updateCountdown();
  };

  // === Función de validación simplificada ===
  const validateAccess = async (event) => {
    if (event) event.preventDefault();
    
    if (isLocked) return;

    const key = $keyInput.value.trim();
    
    if (!key) {
      showMessage('La clave no puede estar vacía');
      $keyInput.focus();
      return;
    }

    attemptCount++;
    setLoading(true);
    updateAttemptsInfo();

    try {
      // Validación directa sin hash para simplificar
      const isValid = ACCESS_KEYS.includes(key);

      if (isValid) {
        showMessage('Acceso concedido', 'success');
        sessionStorage.setItem('cartel_auth', 'true');
        
        await delay(800);
        
        // Transición suave
        $modal.style.opacity = '0';
        await delay(300);
        
        $modal.classList.add('hidden');
        $app.classList.remove('hidden');
        initApp();
        return;
      }

      if (attemptCount >= MAX_ATTEMPTS) {
        lockAccess(LOCK_DURATION);
      } else {
        showMessage(`Clave incorrecta. Intento ${attemptCount}/${MAX_ATTEMPTS}`);
        $keyInput.select();
      }
    } catch (e) {
      console.error('Auth error:', e);
      showMessage('Error interno. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  // === Renderizado ===
  const renderCategories = () => {
    $categoryNav.innerHTML = CATEGORIES.map(cat => `
      <button
        class="category${cat.id === currentCategory ? ' active' : ''}"
        data-id="${cat.id}"
        role="tab"
        aria-selected="${cat.id === currentCategory}"
        tabindex="${cat.id === currentCategory ? '0' : '-1'}"
      >
        ${cat.label}
      </button>
    `).join('');
  };

  const renderSkeleton = () => {
    $grid.innerHTML = Array.from({ length: 6 }, () => `
      <li class="skeleton-card skeleton" aria-hidden="true"></li>
    `).join('');
  };

  const renderAnimes = (animes) => {
    $grid.innerHTML = animes.map(a => {
      const score = a.averageScore ? (a.averageScore / 10).toFixed(1) : '—';
      const genres = a.genres.slice(0, 3).map(g => `<span class="genre">${g}</span>`).join('');
      const title = a.title.romaji
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
      const status = a.status?.replace(/_/g, ' ').toLowerCase() || '';
      return `
        <li class="card" role="article" aria-label="${title}, puntaje: ${score}, estado: ${status}">
          <div class="cover" style="background-image:url('${a.coverImage?.large || ''}')">
            <div class="score-badge">${score}</div>
          </div>
          <div class="content">
            <h3 class="card-title">${title}</h3>
            <p class="meta">${status}</p>
            <div class="genres">${genres}</div>
          </div>
        </li>`;
    }).join('');
  };

  // === API ===
  const fetchAnimes = async (category) => {
    if (cache.has(category)) {
      renderAnimes(cache.get(category));
      return;
    }

    renderSkeleton();
    try {
      const cat = CATEGORIES.find(c => c.id === category);
      const statusFilter = cat.status ? `, status: ${cat.status}` : '';
      const query = `
        query {
          Page(page: 1, perPage: 12) {
            media(sort: ${cat.sort}, type: ANIME${statusFilter}) {
              id
              title { romaji }
              coverImage { large }
              averageScore
              status
              genres
            }
          }
        }
      `;

      const res = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
        mode: 'cors'
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const animes = data.data?.Page?.media || [];

      cache.set(category, animes);
      renderAnimes(animes);
    } catch (e) {
      $grid.innerHTML = `<li class="card" style="grid-column:1/-1;padding:2rem;text-align:center;color:var(--error)">Error al cargar animes</li>`;
    }
  };

  // === App ===
  const switchCategory = (id) => {
    if (currentCategory === id) return;
    currentCategory = id;
    document.querySelectorAll('.category').forEach(btn => {
      const isActive = btn.dataset.id === id;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive);
      btn.tabIndex = isActive ? '0' : '-1';
    });
    fetchAnimes(id);
  };

  const initApp = () => {
    renderCategories();
    fetchAnimes(currentCategory);

    $categoryNav.addEventListener('click', e => {
      const btn = e.target.closest('.category');
      if (btn) switchCategory(btn.dataset.id);
    });

    $categoryNav.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const items = [...$categoryNav.querySelectorAll('.category')];
        const current = items.findIndex(i => i.classList.contains('active'));
        const next = e.key === 'ArrowLeft' ? (current - 1 + items.length) % items.length : (current + 1) % items.length;
        items[next].click();
        items[next].focus();
      }
    });
  };

  // === Inicialización simplificada ===
  const checkSession = () => {
    const saved = sessionStorage.getItem('cartel_auth');
    if (saved === 'true') {
      $modal.classList.add('hidden');
      $app.classList.remove('hidden');
      initApp();
      return true;
    }
    return false;
  };

  // === Eventos simplificados ===
  const initEvents = () => {
    $authForm.addEventListener('submit', validateAccess);
    
    $keyInput.addEventListener('input', () => {
      if ($feedback.textContent) {
        $feedback.textContent = '';
      }
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !$modal.classList.contains('hidden')) {
        e.preventDefault();
        $keyInput.value = '';
        $feedback.textContent = '';
        $keyInput.focus();
      }
    });
  };

  // === Inicio simplificado ===
  const init = () => {
    document.documentElement.classList.remove('no-js');
    document.documentElement.classList.add('supports-js');

    const isAuth = checkSession();
    if (!isAuth) {
      $keyInput.focus();
      updateAttemptsInfo();
    }
    
    initEvents();
  };

  // Inicializar la aplicación
  init();
})();