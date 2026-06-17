/**
 * YAZİYO — kök (Index.html) ve pages/ dizinleri arasında göreli yollar
 */
(function (global) {
    function isInPagesDir() {
        return global.location.pathname.replace(/\\/g, '/').includes('/pages/');
    }

    function homeHref() {
        return isInPagesDir() ? '../Index.html' : 'Index.html';
    }

    function pageHref(filename) {
        return isInPagesDir() ? filename : 'pages/' + filename;
    }

    function assetHref(relativePath) {
        return isInPagesDir() ? '../' + relativePath : relativePath;
    }

    global.YaziyoPaths = { isInPagesDir, homeHref, pageHref, assetHref };
}(typeof window !== 'undefined' ? window : globalThis));
