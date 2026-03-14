/* state.js — Reactive global state store */
const State = (() => {
  let _printers = {};   // id → printer state
  let _cameras  = [];
  let _user     = null;
  const _listeners = {};

  function on(event, fn) {
    if (!_listeners[event]) _listeners[event] = [];
    _listeners[event].push(fn);
  }
  function off(event, fn) {
    if (!_listeners[event]) return;
    _listeners[event] = _listeners[event].filter(f => f !== fn);
  }
  function emit(event, data) {
    (_listeners[event] || []).forEach(fn => fn(data));
  }

  return {
    on, off,

    getUser: () => _user,
    setUser: (u) => { _user = u; emit('user', u); },

    getPrinters: () => _printers,
    getPrinter:  (id) => _printers[id],
    setPrinters: (arr) => {
      _printers = {};
      arr.forEach(p => { _printers[p.id] = p; });
      emit('printers', _printers);
    },
    updatePrinter: (id, state) => {
      if (!_printers[id]) _printers[id] = { id };
      _printers[id] = { ..._printers[id], state };
      emit('printerUpdate', { id, state });
      emit('printers', _printers);
    },
    addPrinterEntry: (printer) => {
      _printers[printer.id] = printer;
      emit('printers', _printers);
    },
    removePrinterEntry: (id) => {
      delete _printers[id];
      emit('printers', _printers);
    },

    getCameras: () => _cameras,
    setCameras: (arr) => { _cameras = arr; emit('cameras', _cameras); },
    addCamera:  (cam) => { _cameras.push(cam); emit('cameras', _cameras); },
    removeCamera: (id) => { _cameras = _cameras.filter(c => c.id !== id); emit('cameras', _cameras); },
  };
})();
