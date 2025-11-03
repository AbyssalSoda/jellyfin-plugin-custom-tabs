// Scope everything in a check to avoid re-declaring the plugin
if (typeof window.customTabsPlugin == 'undefined') {

  window.customTabsPlugin = {
    initialized: false,

    init: function () {
      console.log('CustomTabs: Initializing plugin');
      this.waitForUI();
    },

    waitForUI: function () {
      // Only act on Home
      const hash = window.location.hash || '';
      if (hash !== '' && hash !== '#/home' && hash !== '#/home.html' &&
          !hash.includes('#/home?') && !hash.includes('#/home.html?')) {
        console.debug('CustomTabs: Not on main page, skipping. Hash:', hash);
        return;
      }

      if (typeof ApiClient !== 'undefined' && document.querySelector('.emby-tabs-slider')) {
        console.debug('CustomTabs: UI elements found, creating tabs');
        this.createCustomTabs();
      } else {
        console.debug('CustomTabs: Waiting for UI...');
        setTimeout(() => this.waitForUI(), 200);
      }
    },

    getBase: function () {
      const p = location.pathname;
      return p.includes('/web/') ? p.slice(0, p.indexOf('/web/')) : '';
    },

    toInternalHref: function (redirectUrl) {
      let path = (redirectUrl || '').trim();
      if (!path) return null;
      // Strip "#", "#!/", or "#/"
      path = path.replace(/^#!?\/?/, '');
      // Force classic hashbang (stabler across builds)
      return `${this.getBase()}/web/index.html#!/${path}`;
    },

    // Creates/returns a dedicated container for our content panes, just after the tab bar.
    ensureContentHost: function (tabsSlider) {
      let host = document.getElementById('customTabsContentHost');
      if (!host) {
        host = document.createElement('div');
        host.id = 'customTabsContentHost';
        host.className = 'sections';
        // Insert after the slider
        tabsSlider.parentElement.insertBefore(host, tabsSlider.nextSibling);
      }
      return host;
    },

    hideAllPanes: function () {
      document.querySelectorAll('#customTabsContentHost .pageTabContent')
        .forEach(p => p.style.display = 'none');
      document.querySelectorAll('.emby-tabs-slider .emby-tab-button')
        .forEach(b => b.classList.remove('emby-tab-button-active'));
    },

    createCustomTabs: function () {
      const tabsSlider = document.querySelector('.emby-tabs-slider');
      if (!tabsSlider) { console.debug('CustomTabs: Tabs slider not found'); return; }

      // Avoid duplicates
      if (tabsSlider.querySelector('[id^="customTabButton_"]')) {
        console.debug('CustomTabs: Custom tabs already exist, skipping');
        return;
      }

      ApiClient.fetch({
        url: ApiClient.getUrl('CustomTabs/Config'),
        type: 'GET',
        dataType: 'json',
        headers: { accept: 'application/json' }
      }).then((configs) => {
        console.debug('CustomTabs: Retrieved config for', configs.length, 'tabs');

        const contentHost = this.ensureContentHost(tabsSlider);

        configs.forEach((config, i) => {
          const btnId = `customTabButton_${i}`;
          if (document.getElementById(btnId)) {
            console.debug(`CustomTabs: Tab ${btnId} exists, skipping`);
            return;
          }

          // Build button
          const title = document.createElement('div');
          title.classList.add('emby-button-foreground');
          title.innerText = config.Title || 'Tab';

          const button = document.createElement('button');
          button.type = 'button';
          // Avoid Jellyfin custom elements (use a plain button)
          button.className = 'emby-tab-button emby-button';
          button.setAttribute('data-index', String(i + 2));
          button.id = btnId;
          button.appendChild(title);

          // Behavior: Redirect or Content
          const hasRedirect = !!(config.RedirectUrl && config.RedirectUrl.trim().length);
          if (hasRedirect) {
            const isExternal = !!config.IsExternal;
            const target = config.Target || (isExternal ? '_blank' : '_self');
            const href = isExternal ? config.RedirectUrl : this.toInternalHref(config.RedirectUrl);

            button.addEventListener('click', (ev) => {
              // For internal, do a hard navigation to avoid SPA edge cases:
              // Always prefer classic hashbang for stability.
              ev.preventDefault();
              if (!href) return;
              if (isExternal) {
                window.open(href, target || '_blank', 'noopener,noreferrer');
              } else {
                location.assign(href);
              }
            });
          } else {
            // Content tab: create/attach a dedicated pane
            const paneId = `customTabContent_${i}`;
            let pane = document.getElementById(paneId);
            if (!pane) {
              pane = document.createElement('div');
              pane.id = paneId;
              pane.className = 'tabContent pageTabContent';
              pane.style.display = 'none';
              pane.innerHTML = config.ContentHtml || '';
              contentHost.appendChild(pane);
            }

            button.addEventListener('click', () => {
              this.hideAllPanes();
              button.classList.add('emby-tab-button-active');
              pane.style.display = '';
              // Scroll to content host in case the bar is off-screen
              contentHost.scrollIntoView({ block: 'start', behavior: 'smooth' });
            });
          }

          tabsSlider.appendChild(button);
          console.log(`CustomTabs: Added tab ${btnId}`);
        });

        console.log('CustomTabs: All custom tabs created successfully');
      }).catch((error) => {
        console.error('CustomTabs: Error fetching tab configs:', error);
      });
    }
  };

  // First boot
  if (document.readyState === 'loading') {
    document.addEventListener("DOMContentLoaded", () => window.customTabsPlugin.init());
  } else {
    window.customTabsPlugin.init();
  }

  // Re-init on SPA navigations
  const handleNavigation = () => {
    console.debug('CustomTabs: Navigation detected, re-initializing after delay');
    setTimeout(() => window.customTabsPlugin.init(), 800);
  };
  window.addEventListener("popstate", handleNavigation);
  window.addEventListener("pageshow", handleNavigation);
  window.addEventListener("focus", handleNavigation);

  const originalPushState = history.pushState;
  history.pushState = function () { originalPushState.apply(history, arguments); handleNavigation(); };

  const originalReplaceState = history.replaceState;
  history.replaceState = function () { originalReplaceState.apply(history, arguments); handleNavigation(); };

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) setTimeout(() => window.customTabsPlugin.init(), 300);
  });

  let touchNavigation = false;
  document.addEventListener("touchstart", () => { touchNavigation = true; });
  document.addEventListener("touchend", () => {
    if (touchNavigation) { setTimeout(() => window.customTabsPlugin.init(), 1000); touchNavigation = false; }
  });

  console.log('CustomTabs: Plugin setup complete');
}
