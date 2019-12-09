(function() {
var tag = '<div>Exec: '
  + (performance.now()/1000).toFixed(2)
  + 'sec</div>';
var insertTag = function() {
  document.body.insertAdjacentHTML(
    'beforeend', tag);
};
if (document.body) {
  insertTag();
}
else {
  document.addEventListener(
    "DOMContentLoaded", insertTag
  );
}
})();
