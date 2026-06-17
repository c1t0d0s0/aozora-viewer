import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/book.dart';
import '../providers/book_provider.dart';
import 'reader_view.dart';

class HomeView extends ConsumerStatefulWidget {
  const HomeView({super.key});

  @override
  ConsumerState<HomeView> createState() => _HomeViewState();
}

class _HomeViewState extends ConsumerState<HomeView> {
  final TextEditingController _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final query = ref.watch(searchQueryProvider);
    final filteredBooksAsync = ref.watch(filteredBooksProvider);
    final sortedBookmarks = ref.watch(sortedBookmarksListProvider);
    final isCSVLoading = ref.watch(booksListProvider).isLoading;

    return Scaffold(
      appBar: AppBar(
        title: const Text('青空読書'),
        centerTitle: true,
      ),
      body: Column(
        children: [
          // 検索エリア
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _searchController,
                    decoration: InputDecoration(
                      hintText: '作品名や著者名で検索...',
                      prefixIcon: const Icon(Icons.search),
                      suffixIcon: query.isNotEmpty
                          ? IconButton(
                              icon: const Icon(Icons.clear),
                              onPressed: () {
                                _searchController.clear();
                                ref.read(searchQueryProvider.notifier).setQuery('');
                              },
                            )
                          : null,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      filled: true,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16),
                    ),
                    onChanged: (val) {
                      ref.read(searchQueryProvider.notifier).setQuery(val);
                    },
                    onSubmitted: (val) {
                      ref.read(searchQueryProvider.notifier).setQuery(val);
                    },
                  ),
                ),
              ],
            ),
          ),

          // メインコンテンツ
          Expanded(
            child: query.isEmpty
                ? _buildBookmarksSection(sortedBookmarks, isCSVLoading)
                : _buildSearchResultsSection(filteredBooksAsync),
          ),
        ],
      ),
    );
  }

  // しおりセクション（検索が空のとき）
  Widget _buildBookmarksSection(List<dynamic> bookmarks, bool isCSVLoading) {
    if (bookmarks.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.bookmark_outline, size: 64, color: Colors.grey[600]),
              const SizedBox(height: 16),
              Text(
                isCSVLoading
                    ? '初期データベース（約15MB）を読み込み中...'
                    : '作品名や著者名で検索してください。\n読んだ本にしおりを挟むと、ここに表示されます。',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey[400], height: 1.5, fontSize: 14),
              ),
              if (isCSVLoading) ...[
                const SizedBox(height: 16),
                const SizedBox(
                  width: 150,
                  child: LinearProgressIndicator(),
                ),
              ],
            ],
          ),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
          child: Text(
            isCSVLoading
                ? '現在読んでいる本（しおり一覧） （データベース読み込み中...）'
                : '現在読んでいる本（しおり一覧）',
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Colors.grey),
          ),
        ),
        Expanded(
          child: ListView.builder(
            itemCount: bookmarks.length,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            itemBuilder: (context, index) {
              final bookmark = bookmarks[index];
              final book = bookmark.book;
              final progressPercent = (bookmark.progress * 100).round();

              return Card(
                margin: const EdgeInsets.symmetric(vertical: 6),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                child: InkWell(
                  borderRadius: BorderRadius.circular(12),
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (context) => ReaderView(book: book),
                      ),
                    );
                  },
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                book.title,
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(height: 4),
                              Text(
                                book.author,
                                style: TextStyle(color: Colors.grey[400], fontSize: 14),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(height: 12),
                              // 進捗バー
                              Row(
                                children: [
                                  Expanded(
                                    child: ClipRRect(
                                      borderRadius: BorderRadius.circular(4),
                                      child: LinearProgressIndicator(
                                        value: bookmark.progress,
                                        backgroundColor: Colors.grey[800],
                                        minHeight: 6,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Text(
                                    '読了率: $progressPercent%',
                                    style: TextStyle(fontSize: 12, color: Colors.grey[400]),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 16),
                        IconButton(
                          icon: const Icon(Icons.delete_outline, color: Colors.redAccent),
                          tooltip: 'しおりを消す',
                          onPressed: () => _confirmDeleteBookmark(context, bookmark),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  // 検索結果セクション
  Widget _buildSearchResultsSection(AsyncValue<List<Book>> filteredBooksAsync) {
    return filteredBooksAsync.when(
      data: (books) {
        if (books.isEmpty) {
          return const Center(
            child: Text(
              '作品が見つかりませんでした',
              style: TextStyle(color: Colors.grey),
            ),
          );
        }

        return ListView.separated(
          itemCount: books.length,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          separatorBuilder: (context, index) => const Divider(height: 1),
          itemBuilder: (context, index) {
            final book = books[index];
            return ListTile(
              title: Text(book.title, style: const TextStyle(fontWeight: FontWeight.bold)),
              subtitle: Text(book.author),
              contentPadding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
              onTap: () {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (context) => ReaderView(book: book),
                  ),
                );
              },
            );
          },
        );
      },
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (err, stack) => Center(
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Text('エラーが発生しました: $err', style: const TextStyle(color: Colors.red)),
        ),
      ),
    );
  }

  // 削除の確認ダイアログ
  Future<void> _confirmDeleteBookmark(BuildContext context, dynamic bookmark) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('しおりの削除'),
        content: Text('「${bookmark.book.title}」のしおりを削除しますか？\n（ダウンロード済みのキャッシュも削除されます）'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('キャンセル'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: TextButton.styleFrom(foregroundColor: Colors.redAccent),
            child: const Text('削除'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      await ref.read(bookmarksProvider.notifier).removeBookmark(bookmark.book.url);
    }
  }
}
