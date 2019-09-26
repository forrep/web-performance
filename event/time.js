(function() {
    var tag = '<div style="color: red;">Exec: '
        + (performance.now()/1000).toFixed(2) + 'sec</div>';
    var insertTag = function() {
        document.body.insertAdjacentHTML('beforeend', tag);
    };
    if (document.body) {
        insertTag();
    }
    else {
        document.addEventListener("DOMContentLoaded", insertTag);
    }
})();
