// Fan shorthand → a title AniList's search understands. AniList synonyms cover plenty already;
// these are the ones it misses.
const ALIASES: Record<string, string> = {
  jjk: 'Jujutsu Kaisen', aot: 'Attack on Titan', snk: 'Shingeki no Kyojin', mha: 'My Hero Academia',
  bnha: 'Boku no Hero Academia', csm: 'Chainsaw Man', kny: 'Kimetsu no Yaiba', ds: 'Demon Slayer',
  opm: 'One Punch Man', hxh: 'Hunter x Hunter', fmab: 'Fullmetal Alchemist: Brotherhood', fma: 'Fullmetal Alchemist',
  sxf: 'Spy x Family', op: 'One Piece', db: 'Dragon Ball', dbz: 'Dragon Ball Z', dbs: 'Dragon Ball Super',
  mp100: 'Mob Psycho 100', mob: 'Mob Psycho 100', re0: 'Re:Zero', rezero: 'Re:Zero', sao: 'Sword Art Online',
  tpn: 'The Promised Neverland', cote: 'Classroom of the Elite', jojo: "JoJo's Bizarre Adventure",
  eva: 'Neon Genesis Evangelion', nge: 'Neon Genesis Evangelion', tg: 'Tokyo Ghoul', bc: 'Black Clover',
  sl: 'Solo Leveling', ddd: 'Dandadan', aphd: 'The Apothecary Diaries', kusuriya: 'The Apothecary Diaries',
  bl: 'Blue Lock', frieren: 'Sousou no Frieren', bocchi: 'Bocchi the Rock', aot2: 'Attack on Titan Season 2',
  ngnl: 'No Game No Life', tensura: 'That Time I Got Reincarnated as a Slime', slime: 'That Time I Got Reincarnated as a Slime',
  shield: 'The Rising of the Shield Hero', mt: 'Mushoku Tensei', konosuba: 'KonoSuba', oshinoko: 'Oshi no Ko',
  kaguya: 'Kaguya-sama: Love is War', toradora: 'Toradora', ttgl: 'Tengen Toppa Gurren Lagann', gl: 'Gurren Lagann',
  cg: 'Code Geass', steins: 'Steins;Gate', sg: 'Steins;Gate', vs: 'Vinland Saga', hq: 'Haikyuu', haikyu: 'Haikyuu',
  knb: "Kuroko's Basketball", yyh: 'Yu Yu Hakusho', bleach: 'Bleach', tybw: 'Bleach: Thousand-Year Blood War',
  naruto: 'Naruto', boruto: 'Boruto', ccs: 'Cardcaptor Sakura', pp: 'Psycho-Pass', dn: 'Death Note',
  kaiju: 'Kaiju No. 8', k8: 'Kaiju No. 8', hsdxd: 'High School DxD', sakamoto: 'Sakamoto Days', zom100: 'Zom 100', ms: 'Mashle', gintama: 'Gintama',
  lr: 'Lycoris Recoil', erased: 'Erased', 86: '86 Eighty-Six', akame: 'Akame ga Kill', ag: 'Akame ga Kill',
};

export function expandQuery(q: string): string {
  const key = q.toLowerCase().replace(/[^a-z0-9]/g, '');
  return ALIASES[key] ?? q.trim();
}
