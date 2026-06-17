import sys

file_path = r'c:\Users\Windows 10\Desktop\Yaziyo\pages\kpssCalismasi.html'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

start_marker = '<style>'
end_marker = '</style>'

if start_marker in content and end_marker in content:
    start_idx = content.find(start_marker)
    end_idx = content.find(end_marker) + len(end_marker)
    
    # Remove everything in between and replace with an empty style tag or just remove
    new_content = content[:start_idx] + '' + content[end_idx:]
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Style tag removed successfully")
else:
    print("Style tag not found")
