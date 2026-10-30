(function () {
  function tryInsertButton() {
    const parent = document.querySelector('yt-flexible-actions-view-model');
    if (!parent) return;
    if (parent.querySelector('.ytaq-channel-action-btn')) return;
    const btn = document.createElement('button');
    btn.textContent = 'YTaqボタン';
    btn.className = 'ytaq-channel-action-btn';

    function openYTaqModal() {
      const old = document.getElementById('ytaq-channel-modal');
      if (old) old.remove();
      const overlay = document.createElement('div');
      overlay.id = 'ytaq-channel-modal';

      const modal = document.createElement('div');
      modal.className = 'ytaq-folder-modal';

      const inputWrap = document.createElement('div');
      inputWrap.className = 'ytaq-folder-input-wrap';

      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = '新しいリスト名';

      const addBtn = document.createElement('button');
      addBtn.textContent = '+';
      addBtn.addEventListener('click', async () => {
        const name = input.value.trim();
        if (!name) return;
        if (!window.YTaqListManager) return;
        await window.YTaqListManager.addList(name);
        input.value = '';
        await renderLists();
      });
      inputWrap.appendChild(input);
      inputWrap.appendChild(addBtn);
      modal.appendChild(inputWrap);

      const title = document.createElement('div');
      title.className = 'ytaq-folder-title';
      title.textContent = 'リストに追加/削除';
      modal.appendChild(title);

      const listWrap = document.createElement('div');
      listWrap.className = 'ytaq-folder-list-wrap';
      modal.appendChild(listWrap);

      async function renderLists() {
        listWrap.innerHTML = '';
        if (!window.YTaqListManager) return;
        const lists = await window.YTaqListManager.getLists();
        const channelId = window.YTaqListManager.getChannelId();
        lists.forEach(list => {
          const row = document.createElement('div');
          row.className = 'ytaq-folder-list-row';

          const label = document.createElement('label');
          label.textContent = list.name;

          const cb = document.createElement('input');
          cb.type = 'checkbox';
          const isChannelInList = channelId && list.channels.some(ch =>
            (typeof ch === 'string' ? ch : ch.id) === channelId
          );
          cb.checked = !!isChannelInList;

          cb.addEventListener('change', async () => {
            if (!window.YTaqListManager) return;
            if (!channelId) return;
            if (cb.checked) {
              await window.YTaqListManager.addChannelToList(list.name, channelId);
            } else {
              await window.YTaqListManager.removeChannelFromList(list.name, channelId);
            }
            await renderLists();
          });
          row.appendChild(label);
          row.appendChild(cb);
          listWrap.appendChild(row);
        });
      }

      addBtn.addEventListener('click', renderLists);
      renderLists();
      const closeBtn = document.createElement('button');
      closeBtn.className = 'ytaq-folder-close-btn';
      closeBtn.textContent = '×';
      closeBtn.addEventListener('click', () => overlay.remove());
      modal.appendChild(closeBtn);
      overlay.appendChild(modal);
      overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
      document.body.appendChild(overlay);
    }

    btn.addEventListener('click', openYTaqModal);
    parent.appendChild(btn);
  }

  function setup() {
    window.YTaq.waitFor('yt-flexible-actions-view-model', tryInsertButton);
  }

  window.YTaq.ready(setup);
  window.YTaq.onNavigate(setup);
})();
