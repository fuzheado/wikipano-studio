#!/usr/bin/env python3
"""
Create PanoTour templates on Commons using browser-based editing.
Run this script, then manually complete login if needed.
"""

import subprocess
import tempfile
import time
import json

TEMPLATES = {
    'Template:PanoTour/link': {
        'text': 'https://wikipano.toolforge.org/tour_viewer.html#{{{1}}}',
        'summary': 'Link template for PanoTour'
    },
    'Template:PanoTour/layout': {
        'text': '''{|cellpadding="3" class="toccolours vcard commons-file-information-table" dir="{{#dir:{{{lang|}}}}}" lang="{{{lang|}}}" style="width:100%"
|-
!id="panotourtemplate" class="fileinfo-paramfield" width="15%" |{{{tour|Tour}}}<span class="fn org" style="display:none">{{{name|{{PAGENAME}}}}}</span>
|{{lang|{{{lang|}}}|2={{{text|}}}}}
|}<noinclude>[[Category:Layout templates|{{PAGENAME}}]]</noinclude>''',
        'summary': 'Layout template for PanoTour'
    },
    'Template:PanoTour/en': {
        'text': '''{{PanoTour/layout
|text=View as {{plainlink|1=https://wikipano.toolforge.org/tour_viewer.html#{{SUBPAGENAMEE}}|2=360° interactive tour}} (multiple scenes with navigation)
|lang=en
}}<noinclude>{{Translated tag|navigational}}</noinclude>''',
        'summary': 'English translation for PanoTour'
    },
    'Template:PanoTour': {
        'text': '{{#invoke:Autotranslate|autotranslate|base=PanoTour}}<noinclude>{{documentation}}</noinclude>',
        'summary': 'Create PanoTour template for 360° interactive tour links'
    },
}

def create_template_via_browser(title, text, summary):
    """Open browser to create a template page."""
    # URL encode for edit action
    edit_url = f"https://commons.wikimedia.org/w/index.php?title={title}&action=edit"
    
    print(f"\n{'='*60}")
    print(f"Create: {title}")
    print(f"URL: {edit_url}")
    print(f"{'='*60}")
    print(f"\nSUMMARY: {summary}")
    print(f"\nCONTENT:")
    print("-" * 40)
    print(text)
    print("-" * 40)
    print(f"\n1. Open the URL above in your browser")
    print(f"2. Log in if needed")
    print(f"3. Paste the content above")
    print(f"4. Add the summary above")
    print(f"5. Click 'Save page'")
    print(f"\nPress Enter after saving to continue to next template...")
    input()

def main():
    print("PanoTour Template Creation Guide")
    print("=" * 60)
    print("\nThis script will guide you through creating the PanoTour")
    print("template infrastructure on Commons.\n")
    
    for title, content in TEMPLATES.items():
        create_template_via_browser(title, content['text'], content['summary'])
    
    # Documentation page
    print("\n" + "="*60)
    print("Finally, create the documentation page:")
    print("Template:PanoTour/doc")
    print("="*60)
    print("""
{{Documentation subpage}}
== Usage ==
Place this template on a tour definition page to create a link 
to view it as an interactive 360° tour.

=== Example ===
On <code>User:Example/My_Tour</code> containing tour JSON, add:
<pre>{{PanoTour}}</pre>

This links to: https://wikipano.toolforge.org/tour_viewer.html#User:Example/My_Tour

== See also ==
* {{tl|Pano360}} - for single panorama images

[[Category:Template documentation]]
""")
    
    print("\nDone! All templates created.")
    print("\nTest: Add {{PanoTour}} to User:Fuzheado/Panellum_Tour")

if __name__ == '__main__':
    main()