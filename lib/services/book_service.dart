import 'dart:convert';
import 'dart:io';
import 'package:flutter/services.dart' show rootBundle;
import 'package:csv/csv.dart';
import 'package:http/http.dart' as http;
import 'package:html/parser.dart' as html_parser;
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:charset/charset.dart';

import '../models/book.dart';
import '../models/bookmark.dart';

class BookService {
  static const String _bookmarksKey = 'aozora_bookmarks_v2';
  static const String _cacheFolderName = 'book_cache';

  // 1. CSV から書籍リストをロードしてパースする
  Future<List<Book>> loadBooksFromCSV() async {
    try {
      final csvText = await rootBundle.loadString('aozora_books.csv');
      final List<List<dynamic>> rows = csv.decode(csvText);

      final List<Book> books = [];
      for (final row in rows) {
        if (row.length >= 52) {
          final title = row[1]?.toString().trim() ?? '';
          final author = row[15]?.toString().trim() ?? '';
          final url = row[51]?.toString().trim() ?? '';

          if (title.isNotEmpty && url.isNotEmpty) {
            // ヘッダーや無効なデータを避ける
            if (title == '作品名' || url.startsWith('http://') == false && url.startsWith('https://') == false) {
              continue;
            }
            books.add(Book(title: title, author: author, url: url));
          }
        }
      }
      return books;
    } catch (e) {
      print('Error parsing CSV: $e');
      rethrow;
    }
  }

  // 2. キャッシュディレクトリの取得
  Future<Directory> _getCacheDirectory() async {
    final appDir = await getApplicationDocumentsDirectory();
    final cacheDir = Directory('${appDir.path}/$_cacheFolderName');
    if (!await cacheDir.exists()) {
      await cacheDir.create(recursive: true);
    }
    return cacheDir;
  }

  // キャッシュファイル名の生成 (Electron版のエンコード方式と揃える)
  String _getCacheFilename(String url) {
    return Uri.encodeComponent(url).replaceAll('%', '_') + '.html';
  }

  // 3. 本文を取得する（キャッシュ優先、なければフェッチ）
  Future<String> fetchBookContent(String url) async {
    final cacheDir = await _getCacheDirectory();
    final cacheFile = File('${cacheDir.path}/${_getCacheFilename(url)}');

    // オフラインキャッシュがある場合
    if (await cacheFile.exists()) {
      try {
        print('Loading from local cache: ${cacheFile.path}');
        return await cacheFile.readAsString();
      } catch (e) {
        print('Error reading cache file: $e');
      }
    }

    // キャッシュがない場合ダウンロードする
    print('Fetching content from network: $url');
    final response = await http.get(Uri.parse(url));
    if (response.statusCode != 200) {
      throw HttpException('HTTP Error ${response.statusCode}');
    }

    // Aozora is encoded in Shift_JIS. Decode using charset package
    final decodedHtml = shiftJis.decode(response.bodyBytes);

    // キャッシュに書き込み
    try {
      await cacheFile.writeAsString(decodedHtml);
      print('Saved content to cache: ${cacheFile.path}');
    } catch (e) {
      print('Failed to write cache: $e');
    }

    return decodedHtml;
  }

  // 4. HTMLからルビを除去し、メインテキストをパースする
  String extractMainText(String htmlContent) {
    final document = html_parser.parse(htmlContent);
    final mainTextEl = document.querySelector('.main_text');
    
    if (mainTextEl == null) {
      throw Exception('本文（.main_text）の抽出に失敗しました。');
    }

    // ルビの削除処理 (rtタグの除去)
    final rubyElements = mainTextEl.querySelectorAll('ruby');
    for (final ruby in rubyElements) {
      final rtList = ruby.querySelectorAll('rt');
      for (final rt in rtList) {
        rt.remove();
      }
      // また、ルビの括弧記号等が含まれる場合もあるため、rpタグも削除
      final rpList = ruby.querySelectorAll('rp');
      for (final rp in rpList) {
        rp.remove();
      }
    }

    return mainTextEl.innerHtml;
  }

  // 5. しおり管理
  Future<Map<String, Bookmark>> loadBookmarks() async {
    final prefs = await SharedPreferences.getInstance();
    final jsonStr = prefs.getString(_bookmarksKey);
    if (jsonStr == null || jsonStr.isEmpty) {
      return {};
    }

    try {
      final Map<String, dynamic> rawMap = json.decode(jsonStr) as Map<String, dynamic>;
      final Map<String, Bookmark> bookmarks = {};
      rawMap.forEach((key, value) {
        bookmarks[key] = Bookmark.fromJson(value as Map<String, dynamic>);
      });
      return bookmarks;
    } catch (e) {
      print('Error loading bookmarks: $e');
      return {};
    }
  }

  Future<void> saveBookmark(Bookmark bookmark) async {
    final prefs = await SharedPreferences.getInstance();
    final bookmarks = await loadBookmarks();
    
    bookmarks[bookmark.book.url] = bookmark;
    
    final Map<String, dynamic> rawMap = {};
    bookmarks.forEach((key, val) {
      rawMap[key] = val.toJson();
    });

    await prefs.setString(_bookmarksKey, json.encode(rawMap));
  }

  Future<void> removeBookmark(String url) async {
    final prefs = await SharedPreferences.getInstance();
    final bookmarks = await loadBookmarks();
    
    bookmarks.remove(url);
    
    final Map<String, dynamic> rawMap = {};
    bookmarks.forEach((key, val) {
      rawMap[key] = val.toJson();
    });

    await prefs.setString(_bookmarksKey, json.encode(rawMap));

    // キャッシュファイルの削除
    try {
      final cacheDir = await _getCacheDirectory();
      final cacheFile = File('${cacheDir.path}/${_getCacheFilename(url)}');
      if (await cacheFile.exists()) {
        await cacheFile.delete();
        print('Deleted cache file: ${cacheFile.path}');
      }
    } catch (e) {
      print('Error deleting cache file: $e');
    }
  }
}
