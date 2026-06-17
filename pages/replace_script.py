import sys

file_path = r'c:\Users\Windows 10\Desktop\Yaziyo\pages\kpssCalismasi.html'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace main content
start_marker = '<!-- ANA İÇERİK (Üç Sütunlu Dashboard) -->'
end_marker = '<!-- ============================================ -->\n    <!-- FOOTER'

if start_marker in content and end_marker in content:
    start_idx = content.find(start_marker)
    end_idx = content.find(end_marker)
    
    new_main = """<!-- ANA İÇERİK (Tekli Duyuru Kartı) -->
    <main class="max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex-grow flex items-center justify-center min-h-[calc(100vh-250px)]">
        <!-- Duyuru Kartı -->
        <div class="w-full bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-3xl p-8 sm:p-12 lg:p-16 shadow-2xl flex flex-col items-center justify-center text-center transition-all duration-300 relative overflow-hidden group">
            
            <!-- Arka Plan Dekoratif Işık -->
            <div class="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-yaziyo-gold/10 blur-[80px] rounded-full pointer-events-none"></div>

            <!-- İkon -->
            <div class="w-20 h-20 sm:w-24 sm:h-24 mb-6 sm:mb-8 rounded-full bg-gradient-to-br from-yaziyo-gold/20 to-yaziyo-gold/5 flex items-center justify-center border border-yaziyo-gold/30 shadow-glow-gold relative z-10">
                <i class="fa-solid fa-mobile-screen text-4xl sm:text-5xl text-yaziyo-gold group-hover:scale-110 transition-transform duration-500"></i>
            </div>
            
            <!-- Başlık -->
            <h1 class="font-poppins font-black text-2xl sm:text-3xl lg:text-5xl text-light-text dark:text-dark-text mb-4 sm:mb-6 tracking-tight leading-tight relative z-10">
                YAZİYO - KPSS ÇALIŞMA TAKİBİM
            </h1>
            
            <!-- Alt Metin -->
            <div class="flex items-center justify-center gap-3 mb-8 sm:mb-10 w-full relative z-10">
                <div class="hidden sm:block h-px flex-grow max-w-[80px] bg-gradient-to-r from-transparent to-yaziyo-gold/40"></div>
                <p class="font-inter font-semibold text-base sm:text-xl lg:text-2xl text-yaziyo-gold px-4 text-center">
                    Çok yakında Play Store ve App Store’da
                </p>
                <div class="hidden sm:block h-px flex-grow max-w-[80px] bg-gradient-to-l from-transparent to-yaziyo-gold/40"></div>
            </div>

            <!-- Mağaza İkonları -->
            <div class="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 w-full relative z-10">
                <!-- App Store -->
                <div class="flex items-center gap-4 px-6 py-3 sm:py-4 w-full sm:w-auto bg-light-bg/50 dark:bg-dark-bg/50 border border-light-border dark:border-dark-border rounded-2xl opacity-70 cursor-not-allowed hover:bg-light-bg dark:hover:bg-dark-bg transition-colors">
                    <i class="fa-brands fa-apple text-3xl sm:text-4xl text-light-text dark:text-dark-text"></i>
                    <div class="text-left flex flex-col justify-center">
                        <span class="text-[10px] sm:text-xs uppercase tracking-widest font-bold text-light-text-secondary dark:text-dark-text-secondary">Yakında</span>
                        <span class="text-sm sm:text-base font-bold text-light-text dark:text-dark-text leading-none mt-1">App Store</span>
                    </div>
                </div>
                <!-- Play Store -->
                <div class="flex items-center gap-4 px-6 py-3 sm:py-4 w-full sm:w-auto bg-light-bg/50 dark:bg-dark-bg/50 border border-light-border dark:border-dark-border rounded-2xl opacity-70 cursor-not-allowed hover:bg-light-bg dark:hover:bg-dark-bg transition-colors">
                    <i class="fa-brands fa-google-play text-3xl sm:text-4xl text-light-text dark:text-dark-text"></i>
                    <div class="text-left flex flex-col justify-center">
                        <span class="text-[10px] sm:text-xs uppercase tracking-widest font-bold text-light-text-secondary dark:text-dark-text-secondary">Yakında</span>
                        <span class="text-sm sm:text-base font-bold text-light-text dark:text-dark-text leading-none mt-1">Play Store</span>
                    </div>
                </div>
            </div>

            <!-- Arka Plan Dekoratif İkon -->
            <i class="fa-solid fa-rocket absolute -bottom-10 -right-10 text-[150px] text-yaziyo-gold opacity-[0.03] dark:opacity-[0.05] transform -rotate-12 group-hover:rotate-0 transition-transform duration-700 pointer-events-none"></i>
        </div>
    </main>
    """
    
    new_content = content[:start_idx] + new_main + content[end_idx:]
    
    script_start = '<script>\n        const EXAM_DATES'
    script_end = '    </script>\n    <!-- Supabase CDN -->'
    
    if script_start in new_content and script_end in new_content:
        s_idx = new_content.find(script_start)
        e_idx = new_content.find(script_end)
        
        new_content = new_content[:s_idx] + new_content[e_idx:]
        
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Replacement successful")
else:
    print("Markers not found")
