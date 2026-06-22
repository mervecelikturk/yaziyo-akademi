/**
 * metinlerDB.js içindeki getTotalTextCount değerini textCount.js'e yazar.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const dbPath = path.join(root, 'js', 'metinlerDB.js');
const outPath = path.join(root, 'js', 'textCount.js');

const code = fs.readFileSync(dbPath, 'utf8');
const sandbox = { window: {}, metinlerDB: undefined };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const count = sandbox.getTotalTextCount();

const content = `/**
 * Toplam metin sayısı — metinlerDB.js yerine (ana sayfa performansı).
 * metinlerDB güncellenince: npm run update:text-count
 */
(function (global) {
    const TOTAL_TEXT_COUNT = ${count};

    function getTotalTextCount() {
        return TOTAL_TEXT_COUNT;
    }

    global.getTotalTextCount = getTotalTextCount;
})(typeof window !== 'undefined' ? window : globalThis);
`;

fs.writeFileSync(outPath, content, 'utf8');
console.log(`textCount.js güncellendi: ${count} metin`);
