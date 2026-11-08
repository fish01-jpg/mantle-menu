/* Embedded into every standalone Sp1der entry by scripts/build-sp1der-phone.cjs.
   UI only: no account, message, permission or server-state writes. */
(function () {
    'use strict';
    if (window.Sp1derDevice) return;

    const root = document.documentElement;
    const coarse = window.matchMedia('(pointer: coarse)');
    const compact = window.matchMedia('(max-width: 600px)');
    const nav = window.navigator;
    const phoneUA = /iPhone|iPod|Android.*Mobile|Windows Phone|IEMobile|Opera Mini/i.test(nav.userAgent || '');
    const mobileHint = !!(nav.userAgentData && nav.userAgentData.mobile);
    const shortScreen = Math.min(screen.width || innerWidth, screen.height || innerHeight);
    const physicalPhone = phoneUA || mobileHint || (coarse.matches && shortScreen <= 600);

    function updateDevice() {
        const viewport = window.visualViewport;
        // Layout dimensions, not keyboard height, decide orientation.
        const phone = physicalPhone || compact.matches;
        const orientation = innerWidth > innerHeight ? 'landscape' : 'portrait';
        const changed = !window.Sp1derDevice ||
            window.Sp1derDevice.phone !== phone || window.Sp1derDevice.orientation !== orientation;
        window.Sp1derDevice = { phone, physicalPhone, orientation };
        root.dataset.sp1derDevice = phone ? 'phone' : 'desktop';
        root.dataset.sp1derOrientation = orientation;
        root.style.setProperty('--sp1der-vh', (viewport ? viewport.height : innerHeight) + 'px');
        root.style.setProperty('--sp1der-vtop', (viewport ? viewport.offsetTop : 0) + 'px');
        const editing = document.activeElement && document.activeElement.matches('input,textarea,[contenteditable="true"]');
        root.classList.toggle('sp1der-keyboard', phone && !!editing &&
            !!viewport && innerHeight - viewport.height > 120);
        if (changed) window.dispatchEvent(new CustomEvent('sp1der:devicechange', { detail: window.Sp1derDevice }));
    }
    updateDevice();
    window.addEventListener('resize', updateDevice, { passive: true });
    window.addEventListener('orientationchange', updateDevice, { passive: true });
    document.addEventListener('focusin', updateDevice);
    document.addEventListener('focusout', () => requestAnimationFrame(updateDevice));
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', updateDevice, { passive: true });
        window.visualViewport.addEventListener('scroll', updateDevice, { passive: true });
    }
    [coarse, compact].forEach(mq => {
        if (mq.addEventListener) mq.addEventListener('change', updateDevice);
        else if (mq.addListener) mq.addListener(updateDevice);
    });

    function init() {
        const shell = document.getElementById('appShell');
        const sidebar = document.getElementById('sidebar');
        const menu = document.getElementById('menuBtn');
        const main = shell && shell.querySelector('.main-area');
        if (!shell || !sidebar || !main || !menu) return;
        const isPhone = () => window.Sp1derDevice.phone;
        let desktopCollapsed = sidebar.classList.contains('collapsed');
        let lastPhone = false;
        let navReturn = menu;
        let channelReturn = null;

        function button(label, className, onClick) {
            const el = document.createElement('button');
            el.type = 'button';
            el.className = className;
            el.textContent = label;
            el.addEventListener('click', onClick);
            return el;
        }
        const shade = button('', 'sp1der-nav-shade', () => closeNav(true));
        shade.id = 'sp1derNavShade';
        shade.tabIndex = -1;
        shade.setAttribute('aria-label', 'Close navigation');
        shell.appendChild(shade);

        const close = button('Close menu', 'sp1der-phone-only sp1der-drawer-close', () => closeNav(true));
        sidebar.querySelector('.sidebar-header').appendChild(close);
        const searchWrap = document.createElement('div');
        searchWrap.className = 'sp1der-phone-only sp1der-nav-search';
        const search = document.createElement('input');
        search.type = 'search';
        search.placeholder = 'Find a page...';
        search.setAttribute('aria-label', 'Find a page');
        searchWrap.appendChild(search);
        sidebar.querySelector('.nav-list').before(searchWrap);
        const noPages = document.createElement('p');
        noPages.className = 'sp1der-phone-only sp1der-nav-empty';
        noPages.textContent = 'No pages found. Clear your search to see all pages.';
        noPages.hidden = true;
        noPages.setAttribute('role', 'status');
        sidebar.querySelector('.nav-list').appendChild(noPages);
        const navItems = Array.from(sidebar.querySelectorAll('.nav-item'));
        function filterNav() {
            const query = isPhone() ? search.value.trim().toLowerCase() : '';
            let found = 0;
            navItems.forEach(item => {
                const match = !query || item.textContent.toLowerCase().includes(query);
                item.classList.toggle('sp1der-nav-filtered', !match);
                // Respect permission-based inline display:none; never reveal hidden Admin.
                if (match && item.style.display !== 'none') found++;
            });
            noPages.hidden = found > 0;
        }
        search.addEventListener('input', filterNav);

        const dock = document.createElement('nav');
        dock.id = 'sp1derPhoneDock';
        dock.setAttribute('aria-label', 'Main navigation');
        const paths = {
            home: '<path d="m3 10 9-7 9 7v10H4V10m5 10v-7h6v7"/>',
            community: '<path d="M4 4h16v12H9l-5 4V4Zm4 5h8m-8 3h5"/>',
            games: '<path d="M7 8h10c4 0 6 11 3 11-2 0-3-3-4-3H8c-1 0-2 3-4 3C1 19 3 8 7 8Zm0 2v5m-2-2h4m7-2v.1m3 3v.1"/>',
            more: '<path d="M4 6h16M4 12h16M4 18h16"/>'
        };
        ['home', 'community', 'games', 'more'].forEach(view => {
            const label = view === 'community' ? 'Community' : view[0].toUpperCase() + view.slice(1);
            const b = button('', 'sp1der-dock-button', () => {
                if (view === 'more') { openNav(b); return; }
                const target = navItems.find(item => item.dataset.view === view);
                if (target) target.click();
            });
            b.dataset.view = view;
            b.setAttribute('aria-label', label);
            if (view === 'more') {
                b.setAttribute('aria-controls', 'sidebar');
                b.setAttribute('aria-expanded', 'false');
            }
            b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths[view] + '</svg><span>' + label + '</span>';
            dock.appendChild(b);
        });
        shell.appendChild(dock);
        const more = dock.querySelector('[data-view="more"]');
        menu.setAttribute('aria-controls', 'sidebar');
        menu.setAttribute('aria-expanded', 'false');

        function navOpen() { return isPhone() && !sidebar.classList.contains('collapsed'); }
        function syncNav() {
            const open = navOpen();
            shade.classList.toggle('show', open);
            menu.setAttribute('aria-expanded', String(open));
            more.setAttribute('aria-expanded', String(open));
            main.inert = open;
            dock.inert = open;
            sidebar.inert = isPhone() && !open;
            if (open) {
                sidebar.setAttribute('role', 'dialog');
                sidebar.setAttribute('aria-modal', 'true');
                sidebar.setAttribute('aria-label', 'Site navigation');
            } else {
                sidebar.removeAttribute('role');
                sidebar.removeAttribute('aria-modal');
                sidebar.removeAttribute('aria-label');
            }
            if (!isPhone()) desktopCollapsed = sidebar.classList.contains('collapsed');
        }
        function openNav(trigger) {
            if (!isPhone()) return;
            closeChannels(false);
            navReturn = trigger || menu;
            sidebar.classList.remove('collapsed');
            syncNav();
            close.focus({ preventScroll: true });
        }
        function closeNav(restoreFocus) {
            if (!isPhone()) return;
            sidebar.classList.add('collapsed');
            syncNav();
            if (restoreFocus && navReturn && navReturn.isConnected) navReturn.focus({ preventScroll: true });
        }
        menu.removeAttribute('onclick');
        menu.addEventListener('click', () => {
            if (isPhone()) {
                if (navOpen()) closeNav(true);
                else openNav(menu);
            } else {
                sidebar.classList.toggle('collapsed');
                syncNav();
            }
        });
        sidebar.addEventListener('click', event => {
            if (isPhone() && event.target.closest('.nav-item,.user-chip')) closeNav(false);
        });
        new MutationObserver(syncNav).observe(sidebar, { attributes: true, attributeFilter: ['class'] });

        function syncDock() {
            const active = document.querySelector('.content > .panel.active');
            const view = active ? active.id.replace('panel-', '') : 'home';
            dock.querySelectorAll('[data-view]').forEach(item => {
                const current = item.dataset.view === view ||
                    (item.dataset.view === 'more' && !['home', 'community', 'games'].includes(view));
                if (current) item.setAttribute('aria-current', 'page');
                else item.removeAttribute('aria-current');
            });
            closeChannels(false);
        }
        document.querySelectorAll('.content > .panel').forEach(panel => {
            new MutationObserver(syncDock).observe(panel, { attributes: true, attributeFilter: ['class'] });
        });

        const channelDrawers = [];
        function closeChannels(restoreFocus) {
            const wasOpen = channelDrawers.some(entry => entry.layout.classList.contains('sp1der-channels-open'));
            channelDrawers.forEach(entry => {
                entry.layout.classList.remove('sp1der-channels-open');
                entry.trigger.setAttribute('aria-expanded', 'false');
                entry.channels.inert = isPhone();
                entry.chat.inert = false;
                entry.channels.removeAttribute('role');
                entry.channels.removeAttribute('aria-modal');
                entry.channels.removeAttribute('aria-label');
            });
            if (restoreFocus && wasOpen && channelReturn && channelReturn.isConnected) channelReturn.focus({ preventScroll: true });
        }
        document.querySelectorAll('.chat-layout').forEach((layout, index) => {
            const channels = layout.querySelector('.chat-sidebar');
            const chat = layout.querySelector('.chat-main');
            if (!channels || !chat) return;
            if (!channels.id) channels.id = 'sp1derChannels' + index;
            const trigger = button('Channels', 'sp1der-channel-trigger', () => {
                if (!isPhone()) return;
                const opening = !layout.classList.contains('sp1der-channels-open');
                closeChannels(false);
                if (!opening) return;
                channelReturn = trigger;
                layout.classList.add('sp1der-channels-open');
                trigger.setAttribute('aria-expanded', 'true');
                channels.inert = false;
                chat.inert = true;
                channels.setAttribute('role', 'dialog');
                channels.setAttribute('aria-modal', 'true');
                channels.setAttribute('aria-label', 'Channels');
                back.focus({ preventScroll: true });
            });
            trigger.setAttribute('aria-controls', channels.id);
            trigger.setAttribute('aria-expanded', 'false');
            // Keep this outside .chat-header: channel changes replace its innerHTML.
            chat.prepend(trigger);
            const back = button('Back to chat', 'sp1der-phone-only sp1der-channel-back', () => closeChannels(true));
            channels.prepend(back);
            const overlay = button('', 'sp1der-channel-shade', () => closeChannels(true));
            overlay.setAttribute('aria-label', 'Close channels');
            overlay.tabIndex = -1;
            layout.appendChild(overlay);
            channels.addEventListener('click', event => {
                if (isPhone() && event.target.closest('.chat-channel,.channel-item')) closeChannels(true);
            });
            channels.addEventListener('keydown', event => {
                if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('.channel-item:not(button)')) {
                    event.preventDefault(); event.target.click();
                }
            });
            function labelChannels() {
                channels.querySelectorAll('.channel-item:not(button)').forEach(item => {
                    item.setAttribute('role', 'button'); item.tabIndex = 0;
                });
            }
            new MutationObserver(labelChannels).observe(channels, { childList: true, subtree: true });
            labelChannels();
            channelDrawers.push({ layout, channels, chat, trigger });
        });

        function focusTrap(event, container) {
            const options = Array.from(container.querySelectorAll('button,input,select,textarea,a[href],[tabindex="0"]'))
                .filter(el => !el.disabled && !el.closest('[inert]') && el.getClientRects().length);
            if (!options.length) return;
            const first = options[0], last = options[options.length - 1];
            if (event.shiftKey && (document.activeElement === first || !container.contains(document.activeElement))) {
                event.preventDefault(); last.focus();
            } else if (!event.shiftKey && (document.activeElement === last || !container.contains(document.activeElement))) {
                event.preventDefault(); first.focus();
            }
        }
        document.addEventListener('keydown', event => {
            if (!isPhone()) return;
            const modal = Array.from(document.querySelectorAll('.modal-overlay.active'))
                .filter(el => el.getClientRects().length).pop();
            if (modal) {
                if (event.key === 'Tab') focusTrap(event, modal);
                if (event.key === 'Escape') {
                    const dismiss = modal.querySelector('.sp1der-modal-close');
                    if (dismiss) { event.preventDefault(); dismiss.click(); }
                }
                return;
            }
            if (event.key === 'Escape') {
                if (navOpen()) closeNav(true);
                else closeChannels(true);
            }
            if (event.key === 'Tab') {
                if (navOpen()) focusTrap(event, sidebar);
                else {
                    const entry = channelDrawers.find(item => item.layout.classList.contains('sp1der-channels-open'));
                    if (entry) focusTrap(event, entry.channels);
                }
            }
        });
        const modalFocus = new Map();
        function syncModals() {
            document.querySelectorAll('.modal-overlay').forEach(modal => {
                const active = modal.classList.contains('active') && modal.getClientRects().length;
                if (isPhone() && active && !modalFocus.has(modal)) {
                    modalFocus.set(modal, document.activeElement);
                    const card = modal.querySelector('.modal-card');
                    const dismiss = Array.from(modal.querySelectorAll('button'))
                        .find(b => !b.classList.contains('sp1der-modal-close') &&
                            (/^\s*(?:closeModal\(['"][\w-]+['"]\)|closeGameRunnerModal\(\))\s*;?\s*$/.test(b.getAttribute('onclick') || '') ||
                            /^(close|cancel)$/i.test(b.textContent.trim())));
                    if (card && dismiss && !card.querySelector('.sp1der-modal-close')) {
                        const quickClose = button('Close', 'sp1der-phone-only sp1der-modal-close', () => dismiss.click());
                        quickClose.setAttribute('aria-label', 'Close dialog');
                        card.prepend(quickClose);
                    }
                    if (!modal.contains(document.activeElement)) {
                        const focus = modal.querySelector('input:not([type="hidden"]):not([disabled]),button:not([disabled])');
                        // Focusing a text input here would open the phone keyboard immediately.
                        const firstButton = modal.querySelector('button:not([disabled])');
                        if (firstButton || focus) (firstButton || focus).focus({ preventScroll: true });
                    }
                } else if (!active && modalFocus.has(modal)) {
                    const previous = modalFocus.get(modal);
                    modalFocus.delete(modal);
                    if (previous && previous.isConnected && !previous.closest('[inert]')) previous.focus({ preventScroll: true });
                    else if (isPhone()) menu.focus({ preventScroll: true });
                }
            });
        }
        new MutationObserver(records => {
            if (records.some(record =>
                (record.type === 'attributes' && record.target.matches('.modal-overlay')) ||
                (record.type === 'childList' && Array.from(record.addedNodes)
                    .some(node => node.nodeType === 1 && node.matches('.modal-overlay'))))) syncModals();
        }).observe(document.body, { attributes: true, attributeFilter: ['class'], childList: true, subtree: true });
        // Make existing clickable cards/profile operable without a mouse as well.
        document.querySelectorAll('.home-card,.user-chip').forEach(card => {
            card.setAttribute('role', 'button');
            card.tabIndex = 0;
            card.addEventListener('keydown', event => {
                if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); card.click(); }
            });
        });
        const composer = document.getElementById('composerInput');
        if (composer) composer.setAttribute('aria-label', 'Message');
        const messageInputs = ['composerInput', 'aegisInput', 'feedbackInput']
            .map(id => document.getElementById(id)).filter(Boolean)
            .map(input => ({ input, placeholder: input.placeholder }));
        messageInputs.forEach(({ input }) => {
            input.addEventListener('keydown', event => {
                // The phone Return key writes a newline; the visible Send button sends.
                // Ctrl/Cmd+Enter and all desktop shortcuts keep the original behavior.
                if (isPhone() && event.key === 'Enter' && !event.ctrlKey && !event.metaKey) event.stopImmediatePropagation();
            }, true);
        });
        const appSearch = document.getElementById('appSearch');
        if (appSearch) appSearch.setAttribute('aria-label', 'Search games');

        function syncTour() {
            if (!isPhone()) return;
            const overlay = document.getElementById('tourOverlay');
            const title = document.getElementById('tourTitle');
            const highlight = document.getElementById('tourHighlight');
            if (!overlay || !title || !highlight || !overlay.classList.contains('active')) return;
            const name = title.textContent;
            let target = null;
            if (name === 'Community Chat') target = dock.querySelector('[data-view="community"]');
            else if (name === 'Games') target = dock.querySelector('[data-view="games"]');
            else if (['Sidebar Navigation', 'Phone Navigation', 'Events', 'Staff', 'Aegis AI', 'Settings'].includes(name)) target = more;
            if (name === 'Sidebar Navigation') {
                title.textContent = 'Phone Navigation';
                document.getElementById('tourDesc').textContent = 'Use the navigation bar for Home, Community and Games. Tap More for every page, Settings and your account. It moves to the side when you rotate your phone.';
            }
            highlight.style.display = target ? 'block' : 'none';
            if (target) {
                const rect = target.getBoundingClientRect();
                Object.assign(highlight.style, { left: rect.left + 'px', top: rect.top + 'px',
                    width: rect.width + 'px', height: rect.height + 'px' });
            }
        }
        const tourTitle = document.getElementById('tourTitle');
        if (tourTitle) new MutationObserver(syncTour).observe(tourTitle, { childList: true });

        function syncDevice() {
            const phone = isPhone();
            if (phone !== lastPhone) {
                if (phone) {
                    desktopCollapsed = sidebar.classList.contains('collapsed');
                    sidebar.classList.add('collapsed');
                } else {
                    sidebar.classList.toggle('collapsed', desktopCollapsed);
                    search.value = '';
                }
                lastPhone = phone;
                closeChannels(false);
            }
            filterNav();
            syncNav();
            syncDock();
            syncModals();
            syncTour();
            messageInputs.forEach(({ input, placeholder }) => {
                input.placeholder = phone ? (input.id === 'aegisInput' ? 'Message Aegis AI...' :
                    input.id === 'feedbackInput' ? 'Share an idea...' : 'Write a message...') : placeholder;
                input.enterKeyHint = phone ? 'enter' : '';
            });
        }
        window.addEventListener('sp1der:devicechange', syncDevice);
        syncDevice();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
