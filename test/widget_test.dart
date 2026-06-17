// This is a basic Flutter widget test for AozoraViewer.
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aozora_viewer/main.dart';

void main() {
  testWidgets('App basic boot test', (WidgetTester tester) async {
    // Build our app under ProviderScope and trigger a frame.
    await tester.pumpWidget(
      const ProviderScope(
        child: AozoraViewerApp(),
      ),
    );

    // Verify that the main title '青空読書' is displayed on the screen.
    expect(find.text('青空読書'), findsOneWidget);
  });
}
