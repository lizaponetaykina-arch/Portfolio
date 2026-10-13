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
      dialog.showModal();
      dialog.querySelector('.stats-scroll').scrollTop = 0;
    });
  });
  document.querySelectorAll('.stats-dialog').forEach(dialog => {
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
