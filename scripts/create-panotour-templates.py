#!/usr/bin/env python3
"""
Create PanoTour templates on Wikimedia Commons.

This script creates the template infrastructure for linking tour pages
to the wikipano Toolforge tool.

Templates to create:
- Template:PanoTour (main template using autotranslate)
- Template:PanoTour/link (link template)
- Template:PanoTour/layout (layout template)
- Template:PanoTour/en (English translation)
- Template:PanoTour/doc (documentation)
"""

import pywikibot
import sys

# Template contents
TEMPLATES = {
    'Template:PanoTour': {
        'text': '''{{#invoke:Autotranslate|autotranslate|base=PanoTour}}<noinclude>{{documentation}}</noinclude>''',
        'summary': 'Create PanoTour template for 360° interactive tour links (autotranslate base)'
    },
    'Template:PanoTour/link': {
        'text': '''https://wikipano.toolforge.org/tour_viewer.html#{{{1}}}''',
        'summary': 'Link template for PanoTour - points to wikipano tool'
    },
    'Template:PanoTour/layout': {
        'text': '''{|cellpadding="3" class="toccolours vcard commons-file-information-table" dir="{{#dir:{{{lang|}}}}}" lang="{{{lang|}}}" style="width:100%"
|-
!id="panotourtemplate" class="fileinfo-paramfield" width="15%" |{{{tour|Tour}}}<span class="fn org" style="display:none">{{{name|{{PAGENAME}}}}}</span>
|{{lang|{{{lang|}}}|2={{{text|}}}}}
|}<noinclude>[[Category:Layout templates|{{PAGENAME}}]]</noinclude>''',
        'summary': 'Layout template for PanoTour display'
    },
    'Template:PanoTour/en': {
        'text': '''{{PanoTour/layout
|text=View as {{plainlink|1=https://wikipano.toolforge.org/tour_viewer.html#{{SUBPAGENAMEE}}|2=360° interactive tour}} (multiple scenes with navigation)
|lang=en
}}<noinclude>{{Translated tag|navigational}}</noinclude>''',
        'summary': 'English translation for PanoTour template'
    },
    'Template:PanoTour/doc': {
        'text': '''{{Documentation subpage}}
== Usage ==
Place this template on a tour definition page (a subpage in User: or Commons: namespace) to create a link to view it as an interactive 360° tour.

=== Example ===
On page <code>User:Example/My_Tour</code> containing tour JSON, add:
<pre>{{PanoTour}}</pre>

This creates a link to: https://wikipano.toolforge.org/tour_viewer.html#User:Example/My_Tour

== See also ==
* {{tl|Pano360}} - for single panorama images
* [[Commons:360° panoramas]]

<noinclude>[[Category:Template documentation|{{PAGENAME}}]]</noinclude>''',
        'summary': 'Documentation for PanoTour template'
    }
}


def main():
    site = pywikibot.Site('commons', 'commons')
    
    print(f"Logged in as: {site.username()}")
    print(f"Site: {site}")
    
    for page_title, content in TEMPLATES.items():
        page = pywikibot.Page(site, page_title)
        
        # Check if page already exists
        if page.exists():
            print(f"\n[SKIP] {page_title} already exists")
            current_text = page.text
            if current_text.strip() != content['text'].strip():
                print(f"  Current text differs from new text")
                print(f"  Use --force to overwrite")
            continue
        
        # Create the page
        print(f"\n[CREATE] {page_title}")
        print(f"  Summary: {content['summary']}")
        
        try:
            page.text = content['text']
            page.save(summary=content['summary'], minor=False)
            print(f"  [OK] Created successfully")
        except Exception as e:
            print(f"  [ERROR] Failed: {e}")
            return 1
    
    print("\n=== All templates created ===")
    return 0


if __name__ == '__main__':
    sys.exit(main())