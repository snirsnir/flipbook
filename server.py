#!/usr/bin/env python3
"""
שרת HTTP פשוט להרצת מערכת ה-Flipbook
הפעלה: python server.py
"""

import http.server
import socketserver
import webbrowser
import os

PORT = 8000

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # הוספת headers לתמיכה ב-CORS
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()

    def log_message(self, format, *args):
        # הדפסה מותאמת לעברית
        print(f"[{self.log_date_time_string()}] {format % args}")


def main():
    # שינוי תיקייה לתיקייה הנוכחית
    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    Handler = MyHTTPRequestHandler

    print(f"""
╔══════════════════════════════════════════════╗
║   🚀 שרת Flipbook מקומי                      ║
╚══════════════════════════════════════════════╝

📍 כתובת: http://localhost:{PORT}
📂 תיקייה: {os.getcwd()}

💡 לסגירת השרת: Ctrl+C

═══════════════════════════════════════════════
    """)

    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        # פתיחת הדפדפן אוטומטית
        webbrowser.open(f'http://localhost:{PORT}')

        try:
            print("✅ השרת רץ... (המתן לטעינת הדפדפן)\n")
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n\n👋 השרת נסגר. להתראות!")
            httpd.shutdown()


if __name__ == "__main__":
    main()
