/**
 * Ders metinleri — track: f | q
 */
(function (global) {
    const TOTAL = 30;

    function emptyLessons() {
        return Array.from({ length: TOTAL }, (_, i) => ({
            no: i + 1,
            title: `${i + 1}. Ders`,
            content: '',
        }));
    }

    global.YaziyoDerslerMetinleri = {
        TOTAL,
        tracks: {
            f: global.YaziyoDerslerF || emptyLessons(),
            q: global.YaziyoDerslerQ || emptyLessons(),
        },
        trackLabel(track) {
            const map = {
                f: 'F Klavye Dersleri',
                q: 'Q Klavye Dersleri',
            };
            return map[track] || 'Dersler';
        },
        resolveTrack(params) {
            const track = (params.get('track') || 'f').toLowerCase();
            if (global.YaziyoDerslerMetinleri.tracks[track]) return track;
            return 'f';
        },
    };
}(typeof window !== 'undefined' ? window : globalThis));
