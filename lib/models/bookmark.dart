import 'book.dart';

class Bookmark {
  final Book book;
  final double progress;
  final DateTime lastRead;

  Bookmark({
    required this.book,
    required this.progress,
    required this.lastRead,
  });

  Map<String, dynamic> toJson() => {
        'book': book.toJson(),
        'progress': progress,
        'lastRead': lastRead.millisecondsSinceEpoch,
      };

  factory Bookmark.fromJson(Map<String, dynamic> json) => Bookmark(
        book: Book.fromJson(json['book'] as Map<String, dynamic>),
        progress: (json['progress'] as num).toDouble(),
        lastRead: DateTime.fromMillisecondsSinceEpoch(json['lastRead'] as int),
      );
}
