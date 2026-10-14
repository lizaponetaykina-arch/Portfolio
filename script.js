(() => {
  let opener;
  let previousOverflow;
  let pagePosition;
  let locked = false;
  function restorePage() {
    if (!locked) return;
    locked = false;
    document.documentElement.style.overflow = previousOverflow || '';
    opener?.focus({preventScroll: true});
    window.scrollTo({top: pagePosition, behavior: 'instant'});
  }
  function closeStats(dialog) {
    dialog.close();
    restorePage();
  }
  document.querySelectorAll('[data-stat]').forEach(link => {
    link.addEventListener('click', event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const dialog = document.getElementById(`stats-${link.dataset.stat}`);
      if (!dialog?.showModal) return;
      event.preventDefault();
      opener = link;
      pagePosition = scrollY;
      // Finish any in-flight smooth scroll before locking the document.
      window.scrollTo({top: pagePosition, behavior: 'instant'});
      previousOverflow = document.documentElement.style.overflow;
      locked = true;
      document.documentElement.style.overflow = 'hidden';
      dialog.toggleAttribute('data-pointer-open', event.detail > 0);
      dialog.showModal();
      const content = dialog.querySelector('.stats-scroll');
      content.scrollTop = 0;
      content.focus({preventScroll: true});
    });
  });
  document.querySelectorAll('.stats-dialog').forEach(dialog => {
    // Safari can report :focus-visible on programmatic focus after a tap.
    // Restore the content outline as soon as keyboard navigation begins.
    dialog.addEventListener('keydown', () => dialog.removeAttribute('data-pointer-open'));
    dialog.querySelector('.stats-close').addEventListener('click', () => closeStats(dialog));
    dialog.addEventListener('cancel', event => { event.preventDefault(); closeStats(dialog); });
    let backdropDown = false;
    dialog.addEventListener('pointerdown', event => { backdropDown = event.target === dialog; });
    dialog.addEventListener('click', event => {
      if (backdropDown && event.target === dialog) closeStats(dialog);
      backdropDown = false;
    });
    dialog.addEventListener('close', restorePage);
  });
})();
