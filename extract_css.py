import os
import re

html_path = r'c:\Users\whydo\Documents\FRC 2026\FRC Scouting App\index.html'
with open(html_path, 'r', encoding='utf-8') as f:
    html = f.read()

css_start = html.find('<style>') + 7
css_end = html.find('</style>')
css = html[css_start:css_end]

idx1 = css.find('/* ==========================================================================\n           1. RESET')
css_vars = css[:idx1].strip()

idx2 = css.find('/* ==========================================================================\n           4. NAVIGATION')
idx_resp = css.find('/* RESPONSIVE QUERIES */')
css_layout = css[idx1:idx2].strip() + '\n\n' + css[idx_resp:].strip()

css_mid = css[idx2:idx_resp]
idx_views = css_mid.find('/* DRAFT ROOM / COMPARE STYLES */')
idx_comp2 = css_mid.find('/* ==========================================================================\n           6. COMPONENTS')

css_comp1 = css_mid[:idx_views].strip()
css_views = css_mid[idx_views:idx_comp2].strip()
css_comp2 = css_mid[idx_comp2:].strip()
css_components = css_comp1 + '\n\n' + css_comp2

os.makedirs(r'c:\Users\whydo\Documents\FRC 2026\FRC Scouting App\css', exist_ok=True)
with open(r'c:\Users\whydo\Documents\FRC 2026\FRC Scouting App\css\variables.css', 'w', encoding='utf-8') as f: f.write(css_vars)
with open(r'c:\Users\whydo\Documents\FRC 2026\FRC Scouting App\css\layout.css', 'w', encoding='utf-8') as f: f.write(css_layout)
with open(r'c:\Users\whydo\Documents\FRC 2026\FRC Scouting App\css\components.css', 'w', encoding='utf-8') as f: f.write(css_components)
with open(r'c:\Users\whydo\Documents\FRC 2026\FRC Scouting App\css\views.css', 'w', encoding='utf-8') as f: f.write(css_views)
with open(r'c:\Users\whydo\Documents\FRC 2026\FRC Scouting App\css\main.css', 'w', encoding='utf-8') as f:
    f.write('@import "./variables.css";\n@import "./layout.css";\n@import "./components.css";\n@import "./views.css";\n')

print("CSS Extracted Successfully.")