import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'views/home_view.dart';

void main() {
  runApp(
    const ProviderScope(
      child: AozoraViewerApp(),
    ),
  );
}

class AozoraViewerApp extends StatelessWidget {
  const AozoraViewerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '青空読書',
      debugShowCheckedModeBanner: false,
      // 目の疲れを抑える、Electron版に近いモダンなダークテーマ
      theme: ThemeData(
        useMaterial3: true,
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF121212),
        colorScheme: ColorScheme.fromSeed(
          seedColor: Colors.teal,
          brightness: Brightness.dark,
          surface: const Color(0xFF1E1E1E),
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFF1E1E1E),
          elevation: 0,
          centerTitle: true,
        ),
        cardTheme: const CardThemeData(
          color: Color(0xFF1E1E1E),
          elevation: 2,
        ),
        bottomAppBarTheme: const BottomAppBarThemeData(
          color: Color(0xFF1E1E1E),
          elevation: 4,
        ),
      ),
      home: const HomeView(),
    );
  }
}
