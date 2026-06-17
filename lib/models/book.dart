class Book {
  final String title;
  final String author;
  final String url;

  Book({
    required this.title,
    required this.author,
    required this.url,
  });

  Map<String, dynamic> toJson() => {
        'title': title,
        'author': author,
        'url': url,
      };

  factory Book.fromJson(Map<String, dynamic> json) => Book(
        title: json['title'] as String,
        author: json['author'] as String,
        url: json['url'] as String,
      );

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Book &&
          runtimeType == other.runtimeType &&
          title == other.title &&
          author == other.author &&
          url == other.url;

  @override
  int get hashCode => title.hashCode ^ author.hashCode ^ url.hashCode;
}
