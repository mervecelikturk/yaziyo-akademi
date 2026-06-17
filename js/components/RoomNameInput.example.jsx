/**
 * Örnek React bileşeni — YAZİYO vanilla sayfalarında
 * js/lib/profanityFilter.js + attachRoomNameInput kullanılıyor.
 *
 * Projeye React eklendiğinde profanityFilter modülünü import edin.
 */
import { useCallback, useMemo, useState } from 'react';
import {
    validateRoomName,
    ROOM_NAME_MAX,
    ROOM_NAME_MIN,
} from '../lib/profanityFilter.js';

export function RoomNameInput({
    id = 'room-name',
    label = 'Oda Adı',
    placeholder = 'Örn. Hızlı Parmaklar Arenası',
    value,
    onChange,
    onValidityChange,
    className = '',
}) {
    const [touched, setTouched] = useState(false);

    const result = useMemo(() => validateRoomName(value), [value]);

    const showError = touched && !result.valid;

    const handleChange = useCallback(
        (e) => {
            const next = e.target.value;
            onChange?.(next);
            const v = validateRoomName(next);
            onValidityChange?.(v);
        },
        [onChange, onValidityChange]
    );

    const handleBlur = useCallback(() => {
        setTouched(true);
        onValidityChange?.(validateRoomName(value));
    }, [value, onValidityChange]);

    return (
        <div className={className}>
            <label
                htmlFor={id}
                className="block text-xs font-bold text-yaziyo-gold uppercase tracking-widest mb-2 ml-1"
            >
                {label}
            </label>
            <input
                id={id}
                type="text"
                value={value}
                onChange={handleChange}
                onBlur={handleBlur}
                maxLength={ROOM_NAME_MAX}
                placeholder={placeholder}
                aria-invalid={showError}
                aria-describedby={showError ? `${id}-error` : undefined}
                className={`w-full rounded-xl border px-4 py-3 text-sm transition-colors focus:outline-none focus:border-yaziyo-gold ${
                    showError
                        ? 'border-red-500/60 bg-red-500/5'
                        : 'border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg'
                }`}
            />
            <p className="mt-1 text-[11px] text-light-text-secondary dark:text-dark-text-secondary">
                {ROOM_NAME_MIN}–{ROOM_NAME_MAX} karakter · Harf, rakam ve boşluk
            </p>
            {showError && (
                <p
                    id={`${id}-error`}
                    role="alert"
                    className="mt-1.5 text-xs text-red-500 dark:text-red-400"
                >
                    {result.error}
                </p>
            )}
        </div>
    );
}

/** Form gönderimi öncesi */
export function assertRoomNameSubmit(value) {
    const r = validateRoomName(value);
    if (!r.valid) {
        throw new Error(r.error || 'Geçersiz oda adı');
    }
    return r.value;
}
