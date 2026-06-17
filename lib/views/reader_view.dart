import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:html/parser.dart' as html_parser;
import 'package:html/dom.dart' as html_dom;

import '../models/book.dart';
import '../providers/book_provider.dart';

class ReaderView extends ConsumerStatefulWidget {
  final Book book;

  const ReaderView({super.key, required this.book});

  @override
  ConsumerState<ReaderView> createState() => _ReaderViewState();
}

class _ReaderViewState extends ConsumerState<ReaderView> {
  final ScrollController _scrollController = ScrollController();
  final FlutterTts _flutterTts = FlutterTts();
  
  String? _htmlContent;
  String? _plainText;
  String _errorMessage = '';
  bool _isLoading = true;
  double _progress = 0.0;
  bool _isSaved = false;

  // TTS States
  bool _isTtsPlaying = false;
  bool _isTtsPaused = false;

  @override
  void initState() {
    super.initState();
    _loadBook();
    _initTts();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollController.dispose();
    _flutterTts.stop();
    super.dispose();
  }

  void _initTts() {
    _flutterTts.setLanguage("ja-JP");
    _flutterTts.setSpeechRate(1.0);

    _flutterTts.setStartHandler(() {
      setState(() {
        _isTtsPlaying = true;
        _isTtsPaused = false;
      });
    });

    _flutterTts.setCompletionHandler(() {
      setState(() {
        _isTtsPlaying = false;
        _isTtsPaused = false;
      });
    });

    _flutterTts.setErrorHandler((msg) {
      setState(() {
        _isTtsPlaying = false;
        _isTtsPaused = false;
      });
    });

    _flutterTts.setPauseHandler(() {
      setState(() {
        _isTtsPlaying = false;
        _isTtsPaused = true;
      });
    });

    _flutterTts.setContinueHandler(() {
      setState(() {
        _isTtsPlaying = true;
        _isTtsPaused = false;
      });
    });
  }

  Future<void> _loadBook() async {
    final service = ref.read(bookServiceProvider);
    try {
      final rawHtml = await service.fetchBookContent(widget.book.url);
      final bodyHtml = service.extractMainText(rawHtml);
      
      // 平文（TTS用）の抽出
      final document = html_parser.parseFragment(bodyHtml);
      final plainText = document.text ?? '';

      setState(() {
        _htmlContent = bodyHtml;
        _plainText = plainText;
        _isLoading = false;
      });

      // しおり（進捗）の復元
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _restoreBookmark();
      });
    } catch (e) {
      setState(() {
        _errorMessage = 'エラーが発生しました: ${e.toString()}';
        _isLoading = false;
      });
    }
  }

  void _restoreBookmark() {
    final bookmarks = ref.read(bookmarksProvider);
    final bookmark = bookmarks[widget.book.url];
    if (bookmark != null && bookmark.progress > 0) {
      Future.delayed(const Duration(milliseconds: 200), () {
        if (_scrollController.hasClients) {
          final maxScroll = _scrollController.position.maxScrollExtent;
          if (maxScroll > 0) {
            _scrollController.jumpTo(bookmark.progress * maxScroll);
            setState(() {
              _progress = bookmark.progress;
              _isSaved = true;
            });
          }
        }
      });
    }
  }

  void _onScroll() {
    if (!_scrollController.hasClients) return;
    final maxScroll = _scrollController.position.maxScrollExtent;
    if (maxScroll <= 0) return;
    
    final currentOffset = _scrollController.offset;
    final currentProgress = (currentOffset / maxScroll).clamp(0.0, 1.0);
    
    setState(() {
      _progress = currentProgress;
      _isSaved = false; // スクロールしたら未保存状態に戻す
    });
  }

  Future<void> _saveCurrentBookmark() async {
    if (_isLoading || _htmlContent == null) return;
    await ref.read(bookmarksProvider.notifier).saveBookmark(widget.book, _progress);
    if (!mounted) return;
    setState(() {
      _isSaved = true;
    });
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('しおりを挟みました'), duration: Duration(seconds: 1)),
    );
  }

  // TTS再生制御
  Future<void> _speak() async {
    if (_plainText == null || _plainText!.trim().isEmpty) return;

    if (_isTtsPaused) {
      await _flutterTts.speak(_plainText!); // 機種によってはresume()が使えないため再度speak
      setState(() {
        _isTtsPlaying = true;
        _isTtsPaused = false;
      });
    } else {
      await _flutterTts.speak(_plainText!);
    }
  }

  Future<void> _pause() async {
    await _flutterTts.pause();
    setState(() {
      _isTtsPlaying = false;
      _isTtsPaused = true;
    });
  }

  Future<void> _stop() async {
    await _flutterTts.stop();
    setState(() {
      _isTtsPlaying = false;
      _isTtsPaused = false;
    });
  }

  // 簡単なHTML解析による段落ウィジェットの構築
  List<Widget> _buildContentWidgets() {
    if (_htmlContent == null) return [];

    final document = html_parser.parseFragment(_htmlContent);
    final List<Widget> widgets = [];

    // ヘッダー（タイトルと著者）
    widgets.add(
      Padding(
        padding: const EdgeInsets.symmetric(vertical: 32.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Text(
              widget.book.title,
              style: const TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
                fontFamily: 'Sawarabi Mincho',
                height: 1.5,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 12),
            Text(
              widget.book.author,
              style: const TextStyle(
                fontSize: 16,
                color: Colors.grey,
                fontFamily: 'Sawarabi Mincho',
              ),
              textAlign: TextAlign.center,
            ),
            const Divider(height: 48),
          ],
        ),
      ),
    );

    // 各子ノードを処理
    for (final node in document.nodes) {
      final widget = _parseNode(node);
      if (widget != null) {
        widgets.add(widget);
      }
    }

    // スクロール時にボトム部分が切れないように余白を追加
    widgets.add(const SizedBox(height: 100));

    return widgets;
  }

  Widget? _parseNode(html_dom.Node node) {
    if (node is html_dom.Element) {
      final tag = node.localName;
      if (tag == 'div' || tag == 'p') {
        final text = node.text.trim();
        if (text.isEmpty) return null;
        return Padding(
          padding: const EdgeInsets.only(bottom: 18.0),
          child: Text(
            text,
            style: const TextStyle(
              fontSize: 18,
              height: 1.8,
              fontFamily: 'Sawarabi Mincho',
              letterSpacing: 1.2,
            ),
          ),
        );
      }
    } else if (node.nodeType == html_dom.Node.TEXT_NODE) {
      final text = node.text?.trim() ?? '';
      if (text.isEmpty) return null;
      return Padding(
        padding: const EdgeInsets.only(bottom: 18.0),
        child: Text(
          text,
          style: const TextStyle(
            fontSize: 18,
            height: 1.8,
            fontFamily: 'Sawarabi Mincho',
            letterSpacing: 1.2,
          ),
        ),
      );
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final progressPercent = (_progress * 100).round();

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            _stop();
            Navigator.of(context).pop();
          },
        ),
        title: Text(
          '読了率: $progressPercent%',
          style: const TextStyle(fontSize: 16),
        ),
        actions: [
          TextButton.icon(
            onPressed: _isLoading ? null : _saveCurrentBookmark,
            icon: Icon(
              _isSaved ? Icons.bookmark : Icons.bookmark_border,
              color: _isSaved ? Colors.yellow : Colors.white,
            ),
            label: Text(
              _isSaved ? 'しおり保存済み' : 'しおりを挟む',
              style: const TextStyle(color: Colors.white),
            ),
          ),
        ],
      ),
      body: Stack(
        children: [
          if (_isLoading)
            const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  CircularProgressIndicator(),
                  SizedBox(height: 16),
                  Text('読み込み中...', style: TextStyle(color: Colors.grey)),
                ],
              ),
            )
          else if (_errorMessage.isNotEmpty)
            Center(
              child: Padding(
                padding: const EdgeInsets.all(24.0),
                child: Text(
                  _errorMessage,
                  style: const TextStyle(color: Colors.red, fontSize: 16),
                  textAlign: TextAlign.center,
                ),
              ),
            )
          else
            SafeArea(
              child: SingleChildScrollView(
                controller: _scrollController,
                padding: const EdgeInsets.symmetric(horizontal: 24.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: _buildContentWidgets(),
                ),
              ),
            ),
        ],
      ),
      bottomNavigationBar: _isLoading || _errorMessage.isNotEmpty
          ? null
          : BottomAppBar(
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  if (!_isTtsPlaying)
                    IconButton(
                      icon: const Icon(Icons.play_arrow),
                      iconSize: 32,
                      tooltip: _isTtsPaused ? '再開' : '読み上げ開始',
                      onPressed: _speak,
                    )
                  else
                    IconButton(
                      icon: const Icon(Icons.pause),
                      iconSize: 32,
                      tooltip: '一時停止',
                      onPressed: _pause,
                    ),
                  IconButton(
                    icon: const Icon(Icons.stop),
                    iconSize: 32,
                    tooltip: '停止',
                    onPressed: _stop,
                  ),
                ],
              ),
            ),
    );
  }
}
