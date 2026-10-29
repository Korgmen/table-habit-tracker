import { describe, it, expect } from 'vitest';
import { buildEmojiIndex, searchEmoji, suggestEmoji, emojiInText } from '@/utils/emojiSearch';

const index = buildEmojiIndex([
  ['🏃', 1, 'человек бежит бег марафон спорт'],
  ['🏃‍♀️', 1, 'женщина бежит бег марафон'],
  ['👂', 1, 'ear body'],
  ['🚰', 7, 'питьевая вода кран'],
  ['💧', 4, 'капля вода'],
  ['📖', 7, 'открытая книга чтение'],
  ['🐶', 3, 'морда собаки собака'],
  ['🎵', 6, 'canción música nota'],
  ['📚', 7, '书 书本 阅读'],
]);

describe('searchEmoji', () => {
  it('каждое слово запроса совпадает с началом слова эмодзи, точное совпадение выше', () => {
    expect(searchEmoji(index, 'бег')).toEqual(['🏃', '🏃‍♀️']);
    expect(searchEmoji(index, 'вод')).toEqual(['🚰', '💧']);
    expect(searchEmoji(index, 'вода кран')).toEqual(['🚰']);
    expect(searchEmoji(index, 'Ё-моё')).toEqual([]);
  });

  it('без учёта диакритики и регистра, китайский – по подстроке', () => {
    expect(searchEmoji(index, 'CANCION')).toEqual(['🎵']);
    expect(searchEmoji(index, '阅读')).toEqual(['📚']);
    expect(searchEmoji(index, '   ')).toEqual([]);
  });
});

describe('suggestEmoji', () => {
  it('находит по основе слов названия и показывает один вариант эмодзи', () => {
    expect(suggestEmoji(index, 'Бег по утрам')).toEqual(['🏃']);
    expect(suggestEmoji(index, 'Пить воду')).toEqual(['🚰', '💧']);
    expect(suggestEmoji(index, 'Чтение')).toEqual(['📖']);
    expect(suggestEmoji(index, 'Прогулка с собакой')).toEqual(['🐶']);
    expect(suggestEmoji(index, '每天阅读')).toEqual(['📚']);
  });

  it('короткие слова эмодзи не совпадают по основе', () => {
    expect(suggestEmoji(index, 'Sleep early')).toEqual([]);
    expect(suggestEmoji(index, '')).toEqual([]);
  });
});

describe('emojiInText', () => {
  it('выделяет эмодзи из строки целиком, включая составные', () => {
    expect(emojiInText(' 🏃‍♀️ и 🧘 ')).toEqual(['🏃‍♀️', '🧘']);
    expect(emojiInText('бег')).toEqual([]);
  });
});
