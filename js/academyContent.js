/* Ana sayfa bilgi kartları: büyüyen popup */
(function () {
    const modal = document.getElementById('knowledge-modal');
    const section = document.getElementById('academy-content');
    if (!modal || !section) return;

    const dialog = modal.querySelector('.knowledge-modal-dialog');
    const titleEl = modal.querySelector('#knowledge-modal-title');
    const bodyEl = modal.querySelector('#knowledge-modal-body');
    const iconEl = modal.querySelector('#knowledge-modal-icon');
    const extraWrap = modal.querySelector('#knowledge-modal-extra');
    const closeBtn = modal.querySelector('.knowledge-modal-close');
    const backdrop = modal.querySelector('.knowledge-modal-backdrop');
    let lastFocus = null;

    function setOpen(open) {
        modal.classList.toggle('is-open', open);
        modal.setAttribute('aria-hidden', open ? 'false' : 'true');
        document.body.classList.toggle('knowledge-modal-open', open);
        if (open) {
            closeBtn?.focus();
        } else if (lastFocus && typeof lastFocus.focus === 'function') {
            lastFocus.focus();
        }
    }

    function openFromCard(card) {
        const title = card.querySelector('h3');
        const full = card.querySelector('.knowledge-card-full');
        const icon = card.querySelector('.knowledge-card-icon i');
        const extra = card.querySelector('.knowledge-card-extra');

        if (!title || !full || !titleEl || !bodyEl) return;

        lastFocus = document.activeElement;
        titleEl.textContent = title.textContent.trim();
        bodyEl.innerHTML = full.innerHTML;
        if (iconEl && icon) {
            iconEl.innerHTML = icon.outerHTML;
        }
        if (extraWrap) {
            extraWrap.innerHTML = '';
            if (extra) {
                const clone = extra.cloneNode(true);
                clone.classList.add('knowledge-modal-extra');
                extraWrap.appendChild(clone);
            }
        }
        setOpen(true);
    }

    function closeModal() {
        setOpen(false);
    }

    section.addEventListener('click', (event) => {
        const extraLink = event.target.closest('.knowledge-card-extra');
        if (extraLink) return;

        const card = event.target.closest('.knowledge-card');
        if (!card || !section.contains(card)) return;
        openFromCard(card);
    });

    section.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        const extraLink = event.target.closest('.knowledge-card-extra');
        if (extraLink) return;
        const card = event.target.closest('.knowledge-card');
        if (!card || event.target !== card) return;
        event.preventDefault();
        openFromCard(card);
    });

    closeBtn?.addEventListener('click', closeModal);
    backdrop?.addEventListener('click', closeModal);

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && modal.classList.contains('is-open')) {
            closeModal();
        }
    });

    dialog?.addEventListener('click', (event) => {
        event.stopPropagation();
    });
})();
