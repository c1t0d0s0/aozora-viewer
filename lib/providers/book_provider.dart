import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/book.dart';
import '../models/bookmark.dart';
import '../services/book_service.dart';

// BookService インスタンスの提供
final bookServiceProvider = Provider<BookService>((ref) {
  return BookService();
});

// CSVデータの非同期読み込みプロバイダー
final booksListProvider = FutureProvider<List<Book>>((ref) async {
  final service = ref.watch(bookServiceProvider);
  return service.loadBooksFromCSV();
});

// 検索キーワードのプロバイダー
final searchQueryProvider = StateProvider<String>((ref) => '');

// フィルタリングされた書籍リストのプロバイダー (最大50件)
final filteredBooksProvider = Provider<AsyncValue<List<Book>>>((ref) {
  final booksAsync = ref.watch(booksListProvider);
  final query = ref.watch(searchQueryProvider).trim().toLowerCase();

  return booksAsync.whenData((books) {
    if (query.isEmpty) {
      return []; // 検索ワードが空なら空リスト
    }
    return books.where((book) {
      final titleMatch = book.title.toLowerCase().contains(query);
      final authorMatch = book.author.toLowerCase().contains(query);
      return titleMatch || authorMatch;
    }).take(50).toList();
  });
});

// しおり一覧を管理する StateNotifier
class BookmarksNotifier extends StateNotifier<Map<String, Bookmark>> {
  final BookService _bookService;

  BookmarksNotifier(this._bookService) : super({}) {
    loadBookmarks();
  }

  // しおりを読み込み
  Future<void> loadBookmarks() async {
    final loaded = await _bookService.loadBookmarks();
    state = loaded;
  }

  // しおりを保存/更新
  Future<void> saveBookmark(Book book, double progress) async {
    final bookmark = Bookmark(
      book: book,
      progress: progress,
      lastRead: DateTime.now(),
    );
    await _bookService.saveBookmark(bookmark);
    // 状態を更新
    state = {...state, book.url: bookmark};
  }

  // しおりの削除
  Future<void> removeBookmark(String url) async {
    await _bookService.removeBookmark(url);
    final updated = Map<String, Bookmark>.from(state)..remove(url);
    state = updated;
  }
}

// しおり用プロバイダー
final bookmarksProvider = StateNotifierProvider<BookmarksNotifier, Map<String, Bookmark>>((ref) {
  final service = ref.watch(bookServiceProvider);
  return BookmarksNotifier(service);
});

// 最近読んだ本（しおり）を最終読了日時順にソートしたリスト
final sortedBookmarksListProvider = Provider<List<Bookmark>>((ref) {
  final bookmarks = ref.watch(bookmarksProvider);
  final list = bookmarks.values.toList();
  list.sort((a, b) => b.lastRead.compareTo(a.lastRead));
  return list;
});
