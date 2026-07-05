/**
 * Bio Page Worker
 * A single-file Cloudflare Worker that renders a customizable profile/bio page,
 * inspired by gaming "link in bio" sites — animated backdrop, avatar, status,
 * socials, and a mini audio player.
 *
 * Deploy: wrangler deploy   (or paste into a Worker in the Cloudflare dashboard)
 *
 * Everything you'd want to change lives in the CONFIG object below.
 */

// pfp.webp, hosted on GitHub (raw content URL, so it's a direct image link not a webpage)
const PFP_DATA_URI = "https://raw.githubusercontent.com/sourwisard/images/main/cheezit.png";

// bgg.webp, hosted on GitHub (raw content URL, so it's a direct image link not a webpage)
const BG_DATA_URI = "https://raw.githubusercontent.com/sourwisard/images/main/bgg.webp";


const CONFIG = {
  name: "cheezit",
  taglines: [
  "cheezit my pooookie",
  "meow :3",
	"UwU",
	"bend over",
	"looking mighty fine",
  "i stole all your source code and shoved it through ai",
	"drugz!!! :3",
  "i stole your pfp thanks",
	"how many of these should i do",
	"i need more coffee",
	"nut",
	"yea i'm actually making coffee after i post this",
  "you're short",
	"give me all your money",
	"or i'll leak your school work folder",
	"good boy",
	"lmao",
	"pornhub.com is mid",
	"here click this ip logger https://onbit.pro/2xR35",
	"thanks i'm coming for backshots",
	"made this for you hope you like it",
	"now lets run it back",
  ], // cycles with a typing/backspacing animation
  avatarImage: PFP_DATA_URI, // set to "" to fall back to avatarEmoji instead
  viewerCount: 0,
  // ─── Colors ─────────────────────────────────────────────────────────
  accentColor:  "#3b004e",   // primary accent (name gradient, play btn, seek bar, lyric shimmer)
  accentColor2: "#ff008e",   // secondary accent (card glow, name gradient end, album art bg)
  bodyBg:       "#2a1248 0%, #160a2e 45%, #0a0414", // body radial-gradient stops: "top 0%, mid 45%, bottom 100%"
  panelBg:      "rgba(18, 16, 28, 0.55)", // card / panel glass background
  textColor:    "#f4f3f7",   // main text color
  overlayDark:  "rgba(5, 2, 12, 0.92)",   // lightbox / enter-screen dark overlay
  playBtnText:  "#ffffff",   // icon color inside the play button   // icon color inside the play button
  // ─────────────────────────────────────────────────────────────────────

  bgGradient: ["#0b0f1a", "#161229", "#1a0f1f"], // dark backdrop stops


  // base path for the hosted music + cover art folder
  // (each entry's title/artist pulled from the actual file's embedded ID3 tags)
  tracks: [
    {
      title: "Late Night Walks",
      artist: "Teddy Vogel",
      file: "Late Night Walks 0.mp3",
      cover: "late night walks.jpg",
      lrc: [
        "[00:22.20] One more time (one more time)",
        "[00:24.67] Walk with me and put your hand Into mine",
        "[00:29.43] It's 12 a.m., we're underneath the midnight sky",
        "[00:34.27] Yeah, I got you right here with me, it feels so right",
        "[00:42.96] Yeah, we been walking under the stars for so long",
        "[00:47.91] Yeah, we been talking 'bout everything we long for",
        "[00:52.79] Yeah, it's just you and I (you and I)",
        "[00:56.13] Yeah, I'd love it if you'd be mine (you'd be mine)",
        "[01:01.52] (Only you, girl, it was only you)",
        "[01:04.38] I can't get you out of my mind",
        "[01:08.03] I love you more than all the stars in the sky",
        "[01:13.24] Deep conversations always happen at night",
        "[01:18.04] I think the only thing we can do is try",
        "[01:21.83] Your name echos inside of my mind",
        "[01:25.69] I just can't let go, I'm holding you tight",
        "[01:30.59] I'm not good at saying goodbyes",
        "[01:35.59] So just stay with me one more night (yeah, one more night)",
        "[01:41.36] One last time (one last time)",
        "[01:43.76] Lay with me right here, I'll tell you it's alright (it's alright)",
        "[01:48.53] It's 4 a.m. and we're having the time of our lives (time of our lives)",
        "[01:53.44] We're dancing in the pouring rain, it feels so nice (feels so nice)",
        "[02:02.14] Yeah, we been walking under the stars for so long",
        "[02:06.92] Yeah, we've been talking 'bout everything we long for",
        "[02:11.98] Yeah, it's you in my arms",
        "[02:15.38] Yeah, girl, you can have my heart",
        "[02:20.70] (Only you, girl, it was only you)",
        "[02:23.35] I can't get you out of my mind",
        "[02:27.20] I love you more than all the stars in the sky",
        "[02:32.37] Deep conversations always happen at night",
        "[02:37.26] I think the only thing we can do is try",
        "[02:42.07] (Only you, girl, it was only you)",
        "[02:43.07] I can't get you out of my mind",
        "[02:47.23] I love you more than all the stars in the sky",
        "[02:52.10] Deep conversations always happen at night",
        "[02:57.03] I love you more than all the stars in the sky",
        "[03:00.40] ",
      ],
    },
    {
      title: "Nothing Lasts",
      artist: "Bedroom",
      file: "Nothing Lasts 0.mp3",
      cover: "nothing lasts.jpg",
      lrc: [
        "[00:48.78] I pray to God",
        "[00:54.46] To stop these thoughts",
        "[01:00.78] It works for me",
        "[01:05.12] ",
        "[01:07.54] Can't you see?",
        "[01:13.28] Now I know that I'm better",
        "[01:19.53] I'm writing this letter",
        "[01:25.55] To my past self",
        "[01:30.12] ",
        "[01:32.16] Sitting on the shelf",
        "[01:36.81] ",
        "[02:27.51] Nothing lasts",
        "[02:33.46] It's for the past",
        "[02:37.35] ",
        "[02:39.55] I won't stay here",
        "[02:45.83] I won't stay there",
        "[02:52.08] 'Cause now I'm happy",
        "[02:58.14] For you have changed me",
        "[03:03.99] I am so thankful",
        "[03:10.62] No longer painful",
        "[03:13.51] ",
      ],
    },
    {
      title: "Nostalgic Feel",
      artist: "Bedroom",
      file: "Nostalgic Feel.mp3",
      cover: "nostalgic feel.jpg",
      lrc: [
        "[01:25.56] Blue skies and green fields",
        "[01:38.89] I'm thinking of the older years",
        "",
        "[01:49.48] If I had the chance to relive those days",
        "[01:52.93] I'd take it and I'd run away for good",
        "",
        "[02:01.77] Nostalgia is what I feel, it's vibrant and it is very real",
        "",
        "[02:39.54] Sitting in an open room",
        "[02:52.48] Thinking of how much I miss you",
        "",
        "[03:03.19] I know the future is looking good",
        "[03:06.15] But I would still love to go back if only I could",
        "",
        "[03:15.39] Nostalgia keeps haunting me",
        "[03:18.07] With all of those sweet colored memories",
        "[03:27.87] ",
      ],
    },
    {
      title: "In My Head",
      artist: "Bedroom",
      file: "In My Head 0.mp3",
      cover: "in my head.jpg",
      lrc: [
        "[00:55.82] Day to day, it won't leave",
        "[01:04.93] ",
        "[01:08.53] Every time I try to speak",
        "[01:17.82] ",
        "[01:20.78] It consumes my mind, it consumes my soul",
        "[01:24.03] It wants my life, it wants complete control",
        "[01:33.40] Somebody help me before it's bad",
        "[01:36.62] Somebody help me before I end up dead",
        "[01:44.95] ",
        "[02:24.53] I feel alone all of the time",
        "[02:34.26] ",
        "[02:37.08] It's still quiet, lurking inside",
        "[02:47.18] ",
        "[02:49.77] I'm a walking contradiction",
        "[02:52.95] Everything I say is an affliction to him",
        "[02:58.72] ",
        "[03:02.49] Somebody help me before it's bad",
        "[03:05.63] Somebody help me before I end up dead",
        "[03:10.97] ",
      ],
    },
    {
      title: "Where Is My Mind?",
      artist: "Pixies",
      file: "Where Is My Mind_ 0.mp3",
      cover: "where is my mind.jpg",
      lrc: [
        "[00:00.83] Ooh",
        "[00:02.43] Stop",
        "[00:04.65] ",
        "[00:28.05] With your feet on the air",
        "[00:29.50] And your head on the ground",
        "[00:32.92] ",
        "[00:35.02] Try this trick and spin it, yeah",
        "[00:40.74] Your head will collapse",
        "[00:42.80] If there's nothing in it",
        "[00:44.34] And you'll ask yourself",
        "[00:46.32] Where is my mind?",
        "[00:49.07] Where is my mind?",
        "[00:50.81] Where is my mind?",
        "[00:56.13] ",
        "[01:02.93] Way out in the water, see it swimmin'",
        "[01:10.48] ",
        "[01:15.03] I was swimmin' in the Caribbean",
        "[01:21.64] Animals were hidin' behind the rocks",
        "[01:27.32] Except the little fish, bumped into me",
        "[01:30.35] I swear he was trying to talk to me, koi-koi",
        "[01:32.79] Where is my mind?",
        "[01:35.71] Where is my mind?",
        "[01:37.88] Where is my mind?",
        "[01:43.30] ",
        "[01:50.18] Way out in the water, see it swimmin'",
        "[01:56.99] ",
        "[02:10.05] With your feet on the air",
        "[02:11.15] And your head on the ground",
        "[02:14.56] ",
        "[02:17.29] Try this trick and spin it, yeah",
        "[02:22.64] Your head will collapse",
        "[02:24.32] If there's nothing in it",
        "[02:25.90] And you'll ask yourself",
        "[02:28.25] Where is my mind?",
        "[02:30.92] Where is my mind?",
        "[02:32.73] Where is my mind?",
        "[02:41.74] ",
        "[02:44.45] Way out in the water, see it swimmin'",
        "[02:52.01] ",
        "[03:02.88] With your feet on the air",
        "[03:04.04] And your head on the ground",
        "[03:07.35] ",
        "[03:10.08] Try this trick and spin it, yeah",
        "[03:13.65] ",
      ],
    },
    {
      title: "Someday I'll Get It",
      artist: "Alek Olsen",
      file: "someday i'll get it 0.mp3",
      cover: "someday i'll get it.jpg",
      lrc: [
        "[00:09.81] I think of you all of the time",
        "[00:17.32] Now that you're gone",
        "[00:21.67] ",
        "[00:23.92] I've been doin' all kinds of drugs",
        "[00:31.00] To get you out of my mind",
        "[00:36.87] ",
        "[00:39.09] 'Cause I noticed you don't like me no more",
        "[00:46.36] And it breaks my heart",
        "[00:51.51] ",
        "[00:53.86] So I'll just drift away",
        "[01:00.44] And disappear for a while",
        "[01:04.61] ",
      ],
    },
    {
      title: "The Night We Met",
      artist: "Lord Huron",
      file: "The Night We Met.mp3",
      cover: "the night we met.jpg",
      lrc: [
        "[00:31.00] I am not the only traveler",
        "[00:38.06] Who has not repaid his debt",
        "[00:44.31] I've been searching for a trail to follow again",
        "[00:51.37] Take me back to the night we met",
        "[00:56.90] ",
        "[00:58.93] And then I can tell myself",
        "[01:05.98] What the hell I'm supposed to do",
        "[01:13.31] And then I can tell myself",
        "[01:20.54] Not to ride along with you",
        "[01:27.62] I had all and then most of you",
        "[01:30.41] Some and now none of you",
        "[01:35.06] Take me back to the night we met",
        "[01:42.16] I don't know what I'm supposed to do",
        "[01:44.95] Haunted by the ghost of you",
        "[01:49.21] Oh, take me back to the night we met",
        "[01:56.77] When the night was full of terror",
        "[02:03.92] And your eyes were filled with tears",
        "[02:11.29] When you had not touched me yet",
        "[02:18.03] Oh! Take me back to the night we met",
        "[02:25.62] I had all and then most of you",
        "[02:28.37] Some and now none of you",
        "[02:32.89] Take me back to the night we met",
        "[02:40.11] I don't know what I'm supposed to do",
        "[02:42.81] Haunted by the ghost of you",
        "[02:47.22] Take me back to the night we met",
        "[02:51.54] ",
      ],
    },
    {
      title: "Get You The Moon",
      artist: "Kina, Snøw",
      file: "Get You The Moon 0.mp3",
      cover: "get you the moon.jpg",
      lrc: [
        "[00:15.98] You gave me shoulder when I",
        "[00:19.32] Needed it",
        "[00:22.42] ",
        "[00:24.72] You showed me love when I",
        "[00:27.48] Wasn't feeling it",
        "[00:30.83] ",
        "[00:33.18] You helped me fight when I",
        "[00:35.70] Was giving in",
        "[00:39.05] ",
        "[00:41.30] And you made me laugh when I was losing it",
        "[00:47.54] ",
        "[00:49.86] 'Cause you are, you are the reason why I'm still",
        "[00:55.03] Hangin' on",
        "[00:57.96] 'Cause you are, you are the reason why my head is still",
        "[01:02.52] 'Bove water",
        "[01:05.35] And if I could I'd get you the moon and",
        "[01:10.85] Give it to you",
        "[01:13.28] And if death was coming for you",
        "[01:17.48] I'd give my life for you",
        "[01:21.76] 'Cause you are, you are the reason why I'm still",
        "[01:27.07] Hangin' on",
        "[01:29.66] 'Cause you are, you are",
        "[01:31.62] The reason why my head is still",
        "[01:34.61] 'Bove water",
        "[01:37.45] And if I could I'd get you the moon and",
        "[01:42.94] Give it to you",
        "[01:45.68] And if death was coming for you",
        "[01:49.55] I'd give my life for you",
        "[01:53.79] 'Cause you are, you are",
        "[01:57.62] ",
        "[02:00.62] Oh, you are",
        "[02:06.36] ",
        "[02:08.68] Oh, you are",
        "[02:12.95] ",
        "[02:17.43] You are",
        "[02:22.80] ",
        "[02:25.99] 'Cause you are, you are the reason why I'm still",
        "[02:31.15] Hangin' on",
        "[02:33.73] 'Cause you are, you are the reason why my head is still",
        "[02:38.68] 'Bove water",
        "[02:41.47] And if I could I'd get you the moon and",
        "[02:47.15] Give it to you",
        "[02:49.46] And if death was coming for you",
        "[02:53.56] I'd give my life for you",
        "[02:56.85] ",
      ],
    },
    {
      title: "Swing Lynn",
      artist: "Harmless",
      file: "Swing Lynn (Official Audio) 0.mp3",
      cover: "swing lynn.webp",
      lrc: [
        "[00:49.57] Hey there little honey, won't you groove?",
        "[00:55.85] I've been trying all night to dance with you",
        "[01:01.64] Hey there little lonely, won't you stay?",
        "[01:07.01] I said, \"I would rather die than feel this pain\"",
        "[01:12.76] You said, \"I know, I feel very much the same",
        "[01:18.60] But I'm afraid that I don't know, knowing is not my thing\"",
        "[01:24.68] But I would like to dance with you",
        "[01:30.86] Awkwardly in haze",
        "[01:33.78] To this little tune",
        "[01:37.37] ",
        "[01:37.50] ",
        "[01:59.24] I said, \"Hey there little honey, won't you groove?",
        "[02:05.58] I've been trying all night to dance with you\"",
        "[02:10.72] I said, \"Hey there little honey, won't you stay?\"",
        "[02:16.65] I said, \"I would rather die than feel this pain\"",
        "[02:22.86] You said, \"I know, I feel very much the same",
        "[02:28.61] But I'm afraid that I don't know, knowing is not my thing\"",
        "[02:34.16] But I'm sure, I want to be with you",
        "[02:40.35] Awkwardly in haze",
        "[02:43.13] To our little tune",
        "[02:46.57] ",
        "[03:27.18] Well if you are sure",
        "[03:30.04] Well I know I'm sure",
        "[03:32.49] Well if you are sure",
        "[03:35.12] Well I know I'm sure",
        "[03:38.24] Well if you are sure",
        "[03:41.18] Well I know I'm sure",
        "[03:44.05] Well if you are sure",
        "[03:46.93] Well I know I'm sure",
        "[03:49.93] Well if you are sure",
        "[03:52.88] Well I know I'm sure",
        "[03:55.75] Well if you are sure",
        "[03:58.65] Well I know I'm sure",
        "[04:01.27] Well if you are sure...",
        "[04:03.22] ",
      ],
    },
    {
      title: "Disco",
      artist: "Surf Curse",
      file: "Disco.mp3",
      cover: "disco.jpg",
      lrc: [
        "[00:12.57] And I can't help it with you",
        "[00:17.72] Stubborn-hearted, blue",
        "[00:23.29] Lights come into the room",
        "[00:28.63] When disco plays our tune",
        "[00:33.12] 'Cause there's nothing like it",
        "[00:36.68] Not like the way you move",
        "[00:39.80] I can try but I can't hide it from you",
        "[00:45.40] 'Cause I can't wait for you",
        "[00:51.21] I can't wait for you",
        "[00:56.97] ",
        "[01:08.03] Admire all of you",
        "[01:12.83] But fire burns me too",
        "[01:18.20] Can't stop that disco getting through",
        "[01:23.89] Can't stop that disco wanting you",
        "[01:29.46] 'Cause there's nothing like it",
        "[01:32.46] Locking my eyes with you",
        "[01:35.54] I can't fight it, splitting my mind in two",
        "[01:40.71] 'Cause I can't wait for you",
        "[01:46.37] I can't wait for you",
        "[01:52.01] I can't wait for you",
        "[01:57.22] I can't wait for you",
        "[02:01.93] ",
      ],
    },
    {
      title: "U're Mine",
      artist: "Kina",
      file: "U’re Mine.mp3",
      cover: "u're mine.jpg",
      lrc: [
        "[00:00.03] My, my, my girl",
        "[00:02.30] This is for my girl, my sexy babe",
        "[00:05.86] In my heart, oh, oh",
        "[00:09.49] My, my, my girl",
        "[00:11.97] This is for my girl, my sexy babe",
        "[00:15.59] In my heart, oh, oh",
        "[00:19.04] My, my, my girl",
        "[00:21.41] This is for my girl, my sexy babe",
        "[00:25.11] In my heart, oh, oh",
        "[00:28.70] My, my, my girl",
        "[00:31.12] This is for my girl, my sexy babe",
        "[00:34.83] In my heart, oh, oh",
        "[00:38.41] My, my, my girl",
        "[00:40.64] This is for my girl, my sexy babe",
        "[00:44.25] In my heart, oh, oh",
        "[00:47.81] My, my, my girl",
        "[00:50.22] This is for my girl, my sexy babe",
        "[00:53.73] In my heart, oh, oh",
        "[00:57.55] My, my, my girl",
        "[00:59.93] This is for my girl, my sexy babe",
        "[01:03.56] In my heart, oh, oh",
        "[01:07.00] My, my, my girl",
        "[01:09.60] This is for my girl, my sexy babe",
        "[01:13.05] In my heart, oh, oh",
        "[01:16.69] My, my, my girl",
        "[01:19.19] This is for my girl, my sexy babe",
        "[01:22.76] In my heart, oh, oh",
        "[01:26.34] My, my, my girl",
        "[01:28.64] This is for my girl, my sexy babe",
        "[01:32.34] In my heart, oh, oh",
        "[01:35.95] My, my, my girl",
        "[01:38.29] This is for my girl, my sexy babe",
        "[01:41.94] In my heart, oh, oh",
        "[01:45.51] My, my, my girl",
        "[01:47.98] This is for my girl, my sexy babe",
        "[01:51.43] In my heart, oh, oh",
        "[01:55.22] My, my, my girl",
        "[01:57.44] This is for my girl, my sexy babe",
        "[02:00.96] In my heart, oh, oh",
        "[02:04.68] My, my, my girl",
        "[02:07.40] This is for my girl, my sexy babe",
        "[02:10.68] In my heart, oh, oh",
        "[02:13.15] ",
      ],
    },
    {
      title: "Dream, Ivory",
      artist: "Dream, Ivory, Christian Baello, Louie Baello",
      file: "Dream, Ivory.mp3",
      cover: "dream, ivory.jpg",
      lrc: [
        "[01:05.09] Can't say that I knew",
        "[01:08.82] Away from feeling you",
        "[01:12.94] But can you see it too",
        "[01:15.99] The way the skies are turning blue",
        "[01:20.95] Pastures on my mind",
        "[01:24.43] Running, searching just to find",
        "[01:27.43] A thing or two that once was true",
        "[01:30.98] The part of you that made me new",
        "[01:36.05] Dream dream dream dream dream",
        "[01:40.95] Dream with me",
        "[01:52.07] Dream dream dream dream dream",
        "[01:58.02] Dream with me",
        "[02:35.01] ",
      ],
    },
    {
      title: "Her",
      artist: "The American Dawn",
      file: "Her 0.mp3",
      cover: "her.jpg",
      lrc: [
        "[00:47.35] If you don't want me",
        "[00:51.39] Why'd you steal my heart",
        "[00:55.98] Coast to back country",
        "[00:59.93] No matter where you are",
        "[01:04.26] When the sun comes up",
        "[01:06.51] I'll be thinking of you",
        "[01:09.07] When the sun goes down",
        "[01:11.08] I'll be drinking for two",
        "[01:13.61] You love me a little",
        "[01:15.97] You lie and then",
        "[01:18.20] You love me a little more",
        "[01:20.55] Then I love you all over again",
        "[01:23.44] And again, and again, and again, and again, and again, and again",
        "[01:30.28] ",
        "[02:01.55] No, I don't deserve you",
        "[02:05.07] But I love you",
        "[02:06.77] More than you could know",
        "[02:09.94] In another life",
        "[02:11.98] I've seen your eyes before",
        "[02:18.77] If I die",
        "[02:20.58] Is it better than to live in vain",
        "[02:23.43] Don't cry for me ever baby do your thing",
        "[02:27.94] The way you love me a little, lie and then",
        "[02:32.58] You love me a little more, then I love you all over again",
        "[02:38.36] And again, and again, and again, and again, and again, and again",
        "[02:44.12] ",
      ],
    },
    {
      title: "Stress Relief",
      artist: "late night drive home",
      file: "Stress Relief 0.mp3",
      cover: "stress relief.jpg",
      lrc: [
        "[00:27.92] I never thought you'd end up with me for long, baby",
        "[00:35.15] Not even quicksand could keep you here with me",
        "[00:41.72] I had you in my head, baby, every day",
        "[00:45.36] Towards the end, I just couldn't hear your name",
        "[00:48.40] It's stress relief from everything",
        "[00:53.18] ",
        "[01:02.19] It's stress relief from everything",
        "[01:08.55] Tell me, tell me you love me",
        "[01:11.78] Come back, come back to haunt me",
        "[01:15.40] Won't you, won't you let me be myself?",
        "[01:22.65] I was holding on, but you didn't see my shots, baby",
        "[01:29.94] All the times that I couldn't speak my thoughts, well, maybe",
        "[01:36.54] Well, this is what I wanted, please don't feel so bad",
        "[01:39.94] In love with a ghost, please don't come back",
        "[01:43.34] Well, this is what I wanted, please don't feel so bad",
        "[01:46.88] In love with a ghost, please don't come back",
        "[01:53.39] ",
        "[01:57.04] It's stress relief from everything",
        "[02:03.31] Tell me, tell me you love me",
        "[02:06.67] Come back, come back to haunt me",
        "[02:10.12] Won't you, won't you let me be myself?",
        "[02:17.52] Well, it's difficult, y'know, doing all this",
        "[02:20.64] But it got easier over time (when did you get your picture?)",
        "[02:23.16] But",
        "[02:24.48] Si puedes venir conmigo, amor",
        "[02:28.09] Yo te enseño todo lo que hay",
        "[02:31.68] ¿Porque me tratas asi?",
        "[02:35.13] Como no soy nadie",
        "[02:39.17] ",
        "[02:52.92] Tell me you love me",
        "[02:56.58] Come back to haunt me",
        "[02:59.88] Won't you just let me be myself?",
        "[03:06.70] Tell me, tell me, tell me you, tell me you",
        "[03:10.30] Come back, come back to haunt me",
        "[03:13.86] Won't you, won't you let me be myself?",
        "[03:20.09] ",
      ],
    },
  ],
};

const MUSIC_BASE = "https://raw.githubusercontent.com/sourwisard/images/main/music/";
function musicUrl(filename) {
  return MUSIC_BASE + encodeURIComponent(filename);
}

function renderAvatar(cfg) {
  if (cfg.avatarImage) {
    return `<div class="avatar avatar-img"><img src="${cfg.avatarImage}" alt="${escapeAttr(cfg.name)}" /></div>`;
  }
  return `<div class="avatar">${cfg.avatarEmoji}</div>`;
}

function renderPlayer(cfg) {
  const tracks = cfg.tracks || [];
  if (!tracks.length) return "";
  const first = tracks[0];
  return `
  <div class="player">
    <div class="player-top">
      <div class="player-art"><img id="playerArt" src="${escapeAttr(musicUrl(first.cover))}" alt="" /></div>
      <div class="player-meta">
        <div class="player-title" id="playerTitle">${escapeHtml(first.title)}</div>
        <div class="player-artist" id="playerArtist">${escapeHtml(first.artist)}</div>
        <div class="player-bar">
          <span id="cur">0:00</span>
          <input id="seek" type="range" min="0" max="100" value="0" />
          <span id="dur">0:00</span>
        </div>
      </div>
    </div>
    <div class="player-lyrics" id="playerLyrics"></div>
    <div class="player-controls">
      <button id="prevBtn" class="skip-btn" aria-label="Previous">⏮</button>
      <button id="playBtn" class="play-btn" aria-label="Play"><svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M4 2.5v11l10-5.5z"/></svg></button>
      <button id="nextBtn" class="skip-btn" aria-label="Next">⏭</button>
      <span class="player-count" id="playerCount">1 / ${tracks.length}</span>
    </div>
    <div class="volume-group" id="volumeGroup">
      <button id="volBtn" class="vol-btn" aria-label="Volume">
        <svg id="volIcon" width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M2 6h2.6L8 3.2v9.6L4.6 10H2z"/><path d="M10.2 5.2a3 3 0 0 1 0 5.6v-1.3a1.7 1.7 0 0 0 0-3z"/></svg>
      </button>
      <input id="volSlider" class="vol-slider" type="range" min="0" max="100" value="100" aria-label="Volume level" />
    </div>
    <audio id="audio" src="${escapeAttr(musicUrl(first.file))}" preload="metadata"></audio>
  </div>`;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}
function escapeAttr(str) {
  return escapeHtml(str);
}

function renderPage(cfg) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(cfg.name)}</title>
<style>
  :root {
    --accent:       ${cfg.accentColor};
    --accent2:      ${cfg.accentColor2};
    --panel-bg:     ${cfg.panelBg};
    --text:         ${cfg.textColor};
    --overlay-dark: ${cfg.overlayDark};
    --play-text:    ${cfg.playBtnText};
  }
  * { box-sizing: border-box; }
  html, body {
    min-height: 100%;
    margin: 0;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: var(--text);
  }
  body {
    background: radial-gradient(circle at 50% 0%, ${cfg.bodyBg});
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    position: relative;
    padding: 48px 20px;
    gap: 48px;
    overflow-x: hidden;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  .stars {
    position: fixed;
    inset: 0;
    pointer-events: none;
    background-image:
      radial-gradient(1px 1px at 10% 20%, rgba(255,255,255,.5), transparent),
      radial-gradient(1px 1px at 80% 10%, rgba(255,255,255,.4), transparent),
      radial-gradient(2px 2px at 60% 70%, rgba(255,255,255,.3), transparent),
      radial-gradient(1px 1px at 30% 80%, rgba(255,255,255,.4), transparent),
      radial-gradient(1px 1px at 90% 60%, rgba(255,255,255,.3), transparent);
    animation: drift 60s linear infinite;
    opacity: .8;
  }
  @keyframes drift {
    from { transform: translateY(0); }
    to { transform: translateY(-200px); }
  }
  .card {
    position: relative;
    z-index: 2;
    width: min(380px, 90vw);
    padding: 36px 28px 28px;
    border-radius: 20px;
    background: var(--panel-bg);
    backdrop-filter: blur(18px);
    border: 1px solid rgba(255,255,255,0.08);
    box-shadow: 0 0 60px -10px var(--accent2), 0 20px 60px rgba(0,0,0,0.5);
    text-align: center;
    animation: rise .6s ease;
  }
  @keyframes rise {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .avatar {
    width: 92px;
    height: 92px;
    margin: 0 auto 14px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 42px;
    background: linear-gradient(140deg, var(--accent), var(--accent2));
    box-shadow: 0 0 0 4px rgba(255,255,255,0.06), 0 0 30px -4px var(--accent);
    animation: float 4s ease-in-out infinite;
  }
  @keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-6px); }
  }
  .avatar-img {
    overflow: hidden;
    background: #000;
  }
  .avatar-img img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  /* To use your own background image instead of the gradient, add a class
     like this and apply it to <body>, or just edit the body{} rule above
     to add: background-image: url('data:image/webp;base64,...');
     (see the chat instructions for how to generate that string) */
  .name {
    font-size: 22px;
    font-weight: 700;
    background: linear-gradient(90deg, var(--accent), var(--accent2));
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    margin-bottom: 6px;
    letter-spacing: 0.5px;
  }
  .tagline {
    font-size: 13.5px;
    color: rgba(244,243,247,0.75);
    margin-bottom: 18px;
    line-height: 1.4;
    text-align: left;
    height: 80px;
  }
  .tagline-inner {
    display: flex;
    align-items: flex-start;
    text-align: left;
    width: 100%;
    gap: 10px;
  }
  .typing-icon {
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    object-fit: cover;
    border-radius: 50%;
    background: rgba(255,255,255,0.08);
    border: none;
    padding: 0;
    box-sizing: border-box;
    margin-top: 2px;
  }
  .tagline-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
    font-weight: 500;
  }
  .tagline-username {
    color: #ffffff;
    font-weight: 600;
  }
  .tagline-timestamp {
    font-size: 12px;
    color: rgba(244,243,247,0.5);
  }
  .tagline-bubble {
    display: block;
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 16px;
    padding: 9px 13px;
    max-width: 100%;
    min-height: 2.8em;
    line-height: 1.4;
  }
  .tagline .cursor {
    display: inline-block;
    width: 2px;
    height: 1em;
    vertical-align: middle;
    margin-left: 1px;
    background: rgba(244,243,247,0.6);
    animation: blink 0.9s step-end infinite;
  }
  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }
  .player {
    display: flex;
    flex-direction: column;
    gap: 12px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 14px;
    padding: 12px 14px;
    text-align: left;
    width: 100%;
  }
  .player-top {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }
  .player-art {
    width: 44px;
    height: 44px;
    border-radius: 8px;
    background: linear-gradient(140deg, var(--accent2), var(--accent));
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    overflow: hidden;
  }
  .player-art img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .player-meta { flex: 1; min-width: 0; }
  .player-title {
    font-size: 12.5px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .player-artist {
    font-size: 11px;
    color: rgba(244,243,247,0.5);
    margin-bottom: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .player-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    color: rgba(244,243,247,0.5);
    min-width: 0;
  }
  .player-bar span {
    flex-shrink: 0;
    white-space: nowrap;
  }
  .player-bar input[type="range"] {
    flex: 1;
    min-width: 0;
    height: 3px;
    accent-color: var(--accent);
    cursor: pointer;
  }
  .player-lyrics {
    margin-top: 10px;
    height: 66px;
    overflow: hidden;
    text-align: center;
    border-top: 1px solid rgba(255,255,255,0.08);
    position: relative;
  }
  .player-lyrics-track {
    display: flex;
    flex-direction: column;
    align-items: center;
    transition: transform 0.75s cubic-bezier(0.16, 1, 0.3, 1);
    will-change: transform;
  }
  @keyframes lyric-shimmer {
    0%   { background-position: 100% center; }
    100% { background-position: -100% center; }
  }
  .player-lyric-line {
    font-size: 11.5px;
    font-weight: 500;
    line-height: 1.45;
    width: 100%;
    padding: 3px 10px;
    box-sizing: border-box;
    white-space: normal;
    word-break: break-word;
    color: color-mix(in srgb, var(--accent) 30%, transparent);
    transition: color 0.75s ease, font-size 0.75s cubic-bezier(0.16, 1, 0.3, 1), font-weight 0.6s ease, opacity 0.75s ease;
  }
  .player-lyric-line.active {
    font-size: 13px;
    font-weight: 600;
    background: linear-gradient(
      90deg,
      var(--accent) 0%,
      color-mix(in srgb, var(--accent) 70%, #fff) 30%,
      #ffffff 48%,
      color-mix(in srgb, var(--accent) 50%, #fff) 52%,
      var(--accent) 70%,
      color-mix(in srgb, var(--accent) 70%, #fff) 100%
    );
    background-size: 200% auto;
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    animation: lyric-shimmer 2s linear infinite;
  }

  .player-controls {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding-right: 0;
    width: 100%;
    order: 1;
  }
  .play-btn {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    border: none;
    background: var(--accent);
    color: var(--play-text);
    cursor: pointer;
    flex-shrink: 0;
    font-size: 13px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform .15s ease;
  }
  .play-btn:active {
    transform: scale(0.92);
  }
  .skip-btn {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: none;
    background: rgba(255,255,255,0.08);
    color: rgba(244,243,247,0.8);
    cursor: pointer;
    flex-shrink: 0;
    font-size: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform .15s ease, color .15s ease, background .15s ease;
  }
  .skip-btn:hover {
    color: var(--accent);
    background: rgba(255,255,255,0.14);
  }
  .skip-btn:active {
    transform: scale(0.92);
  }
  .player-count {
    position: absolute;
    right: 0;
    font-size: 10.5px;
    color: rgba(244,243,247,0.45);
    flex-shrink: 0;
  }
  .volume-group {
    position: relative;
    left: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    order: 2;
  }
  .vol-btn {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: none;
    background: rgba(255,255,255,0.08);
    color: rgba(244,243,247,0.75);
    cursor: pointer;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color .15s ease, background .15s ease;
  }
  .vol-btn:hover {
    color: var(--accent);
    background: rgba(255,255,255,0.14);
  }
  .vol-slider {
    width: 100%;
    opacity: 1;
    height: 3px;
    accent-color: var(--accent);
    cursor: pointer;
    transition: width .2s ease, opacity .2s ease, margin .2s ease;
    margin-left: 2px;
    flex: 1;
  }
  .volume-group:hover .vol-slider,
  .volume-group:focus-within .vol-slider {
    width: 100%;
    opacity: 1;
    margin-left: 2px;
  }
  .page-content {
    transition: filter .6s ease;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 32px;
  }
  .page-content.blurred {
    filter: blur(18px);
    pointer-events: none;
  }
  .enter-screen {
    position: fixed;
    inset: 0;
    z-index: 200;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(5,2,12,0.55);
    cursor: pointer;
    transition: opacity .6s ease;
  }
  .enter-screen.hidden {
    opacity: 0;
    pointer-events: none;
  }
  .enter-box {
    text-align: center;
  }
  .enter-text {
    font-size: 14px;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: var(--text);
    padding: 16px 28px;
    border: 1px solid rgba(255,255,255,0.25);
    border-radius: 999px;
    background: rgba(255,255,255,0.06);
    backdrop-filter: blur(6px);
    animation: pulseEnter 1.8s ease-in-out infinite;
  }
  @keyframes pulseEnter {
    0%, 100% { box-shadow: 0 0 0 0 rgba(255,255,255,0.12); }
    50% { box-shadow: 0 0 0 10px rgba(255,255,255,0); }
  }
  .playlist-btn {
    width: min(380px, 90vw);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 14px 20px;
    border-radius: 999px;
    background: var(--panel-bg);
    backdrop-filter: blur(18px);
    border: 1px solid rgba(255,255,255,0.08);
    box-shadow: 0 10px 30px rgba(0,0,0,0.4);
    color: var(--text);
    font-size: 14px;
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
    transition: transform .15s ease, background .15s ease;
  }
  .playlist-btn:hover {
    transform: translateY(-2px);
    background: rgba(255,255,255,0.1);
  }
  .playlist-btn img {
    width: 50px;
    height: 50px;
    object-fit: contain;
    flex-shrink: 0;
  }
</style>
</head>
<body>
  <div id="enterScreen" class="enter-screen">
    <div class="enter-box">
      <div class="enter-text">click to enter</div>
    </div>
  </div>
  <div id="pageContent" class="page-content blurred">
  <div class="stars"></div>
  <div class="card">
    ${renderAvatar(cfg)}
    <div class="name">${escapeHtml(cfg.name)}</div>
    <div class="tagline"><div class="tagline-inner"><img class="typing-icon" src="https://raw.githubusercontent.com/sourwisard/images/main/pwep.png" alt="" /><div style="flex: 1;"><div class="tagline-header"><span class="tagline-username">sourwisard</span></div><span class="tagline-bubble"><span id="taglineText"></span><span class="cursor"></span></span></div></div></div>
    ${renderPlayer(cfg)}
  </div>
  <a class="playlist-btn" href="https://music.youtube.com/playlist?list=PLIDKt1VOzMKQN199j9FCCflJDSx90xnoX&si=J7a_ScRTl7Nx1Mkx" target="_blank" rel="noopener">
    <img src="https://raw.githubusercontent.com/sourwisard/images/main/on_platform_logo_dark.svg" alt="" />
    <span>the playlist of this</span>
  </a>

  </div>

<script>
  (function () {
    const enterScreen = document.getElementById('enterScreen');
    const pageContent = document.getElementById('pageContent');
    const audio = document.getElementById('audio');

    enterScreen.addEventListener('click', () => {
      pageContent.classList.remove('blurred');
      enterScreen.classList.add('hidden');
      document.body.style.overflow = '';
      if (audio) {
        audio.play().catch(() => {});
        const playBtn = document.getElementById('playBtn');
        if (playBtn) playBtn.textContent = '❚❚';
      }
      setTimeout(() => enterScreen.remove(), 600);
      window.dispatchEvent(new Event('pageEntered'));
    }, { once: true });
  })();
</script>
<script>
  (function () {
    const taglines = ${JSON.stringify(cfg.taglines)};
    const el = document.getElementById('taglineText');
    if (!el || !taglines.length) return;

    let textIndex = 0;
    let charIndex = 0;
    let deleting = false;

    const TYPE_SPEED = 55;
    const DELETE_SPEED = 30;
    const HOLD_AFTER_TYPE = 2800;
    const HOLD_AFTER_DELETE = 300;

    function tick() {
      const current = taglines[textIndex];

      if (!deleting) {
        charIndex++;
        el.textContent = current.slice(0, charIndex);
        if (charIndex === current.length) {
          deleting = true;
          setTimeout(tick, HOLD_AFTER_TYPE);
          return;
        }
        setTimeout(tick, TYPE_SPEED);
      } else {
        charIndex--;
        el.textContent = current.slice(0, charIndex);
        if (charIndex === 0) {
          deleting = false;
          textIndex = (textIndex + 1) % taglines.length;
          setTimeout(tick, HOLD_AFTER_DELETE);
          return;
        }
        setTimeout(tick, DELETE_SPEED);
      }
    }

    window.addEventListener('pageEntered', tick, { once: true });
  })();
</script>

<script>
  (function () {
    const audio = document.getElementById('audio');
    if (!audio) return;
    const tracks = ${JSON.stringify(cfg.tracks || [])};
    const MUSIC_BASE = "https://raw.githubusercontent.com/sourwisard/images/main/music/";
    const musicUrl = (f) => MUSIC_BASE + encodeURIComponent(f);

    const playBtn = document.getElementById('playBtn');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const seek = document.getElementById('seek');
    const cur = document.getElementById('cur');
    const dur = document.getElementById('dur');
    const art = document.getElementById('playerArt');
    const titleEl = document.getElementById('playerTitle');
    const artistEl = document.getElementById('playerArtist');
    const countEl = document.getElementById('playerCount');
    const volBtn = document.getElementById('volBtn');
    const volIcon = document.getElementById('volIcon');
    const volSlider = document.getElementById('volSlider');

    const PLAY_ICON = '<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M4 2.5v11l10-5.5z"/></svg>';
    const PAUSE_ICON = '<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><rect x="3" y="2.5" width="3.5" height="11" rx="1"/><rect x="9.5" y="2.5" width="3.5" height="11" rx="1"/></svg>';
    const VOL_ICON = '<path d="M2 6h2.6L8 3.2v9.6L4.6 10H2z"/><path d="M10.2 5.2a3 3 0 0 1 0 5.6v-1.3a1.7 1.7 0 0 0 0-3z"/>';
    const VOL_MUTE_ICON = '<path d="M2 6h2.6L8 3.2v9.6L4.6 10H2z"/><path d="M10.5 5.5l3.5 5M14 5.5l-3.5 5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>';

    let index = 0;
    let lastVolume = 1;
    let lyricsData = [];
    let currentLyricIndex = -1;

    function parseLRC(lines) {
      if (!lines || !lines.length) return [];
      const parsed = [];
      const timeRegex = /\\[(\\d{2}):(\\d{2})\\.(\\d{2,3})\\]/;
      for (const line of lines) {
        const match = timeRegex.exec(line);
        if (match) {
          const min = parseInt(match[1], 10);
          const sec = parseInt(match[2], 10);
          const ms = parseInt(match[3], 10) * (match[3].length === 2 ? 10 : 1);
          const time = min * 60 + sec + ms / 1000;
          const text = line.replace(timeRegex, '').trim();
          parsed.push({ time, text });
        }
      }
      return parsed.sort((a, b) => a.time - b.time);
    }

    function renderLyrics(data) {
      const container = document.getElementById('playerLyrics');
      if (!container) return;
      container.innerHTML = '<div class="player-lyrics-track" id="lyricsTrack"></div>';
      const track = document.getElementById('lyricsTrack');
      data.forEach((lyric, i) => {
        const div = document.createElement('div');
        div.className = 'player-lyric-line';
        div.id = 'lyric-' + i;
        div.dataset.raw = lyric.text || '';
        div.textContent = lyric.text || '';
        track.appendChild(div);
      });
    }

    function scrollToActive(idx) {
      const container = document.getElementById('playerLyrics');
      const track = document.getElementById('lyricsTrack');
      if (!container || !track) return;
      // use first lyric if before song starts
      const targetIdx = idx < 0 ? 0 : idx;
      const el = document.getElementById('lyric-' + targetIdx);
      if (!el) return;
      // measure where this element sits within the track
      const elTop = el.offsetTop;
      const elHeight = el.offsetHeight;
      const containerHeight = container.offsetHeight;
      // center the active line in the container
      const offset = -(elTop - (containerHeight / 2) + (elHeight / 2));
      track.style.transform = 'translateY(' + offset + 'px)';
    }

    // measure the best wrap point for a line at active font size, before it animates
    function prewrapLine(el) {
      if (!el) return;
      const text = el.dataset.raw;
      if (!text) return;
      const words = text.split(' ');
      if (words.length < 3) return; // short enough, no need

      const width = el.offsetWidth;
      // probe each split point with a hidden single-line span
      const probe = document.createElement('span');
      probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font-size:13px;font-weight:600;padding:0 10px;box-sizing:border-box;';
      document.body.appendChild(probe);

      // find the longest first-half that still fits
      let bestSplit = -1;
      for (let i = 1; i < words.length; i++) {
        probe.textContent = words.slice(0, i).join(' ');
        if (probe.offsetWidth <= width) {
          bestSplit = i;
        } else {
          break;
        }
      }
      document.body.removeChild(probe);

      // only insert BR if the full line doesn't fit on one line
      const fullProbe = document.createElement('span');
      fullProbe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font-size:13px;font-weight:600;padding:0 10px;box-sizing:border-box;';
      fullProbe.textContent = text;
      document.body.appendChild(fullProbe);
      const needsWrap = fullProbe.offsetWidth > width;
      document.body.removeChild(fullProbe);

      if (!needsWrap) return;

      if (bestSplit > 0 && bestSplit < words.length) {
        el.innerHTML = words.slice(0, bestSplit).join(' ') + '<br>' + words.slice(bestSplit).join(' ');
      }
    }

    function syncLyrics(currentTime) {
      if (!lyricsData.length) return;
      let nextActive = -1;
      for (let i = 0; i < lyricsData.length; i++) {
        if (currentTime >= lyricsData[i].time) {
          nextActive = i;
        } else {
          break;
        }
      }
      if (nextActive !== currentLyricIndex) {
        if (currentLyricIndex >= 0) {
          const oldEl = document.getElementById('lyric-' + currentLyricIndex);
          if (oldEl) oldEl.classList.remove('active');
        }
        currentLyricIndex = nextActive;
        if (currentLyricIndex >= 0) {
          const newEl = document.getElementById('lyric-' + currentLyricIndex);
          if (newEl) {
            prewrapLine(newEl);
            newEl.classList.add('active');
          }
        }
        scrollToActive(currentLyricIndex);
      }
    }

    function fmt(s) {
      if (!isFinite(s)) return '0:00';
      const m = Math.floor(s / 60), sec = Math.floor(s % 60);
      return m + ':' + String(sec).padStart(2, '0');
    }

    function loadTrack(i, autoplay) {
      index = ((i % tracks.length) + tracks.length) % tracks.length;
      const t = tracks[index];
      audio.src = musicUrl(t.file);
      if (art) art.src = musicUrl(t.cover);
      if (titleEl) titleEl.textContent = t.title;
      if (artistEl) artistEl.textContent = t.artist;
      if (countEl) countEl.textContent = (index + 1) + ' / ' + tracks.length;
      lyricsData = parseLRC(t.lrc);
      currentLyricIndex = -2; // force update on first syncLyrics call
      renderLyrics(lyricsData);
      syncLyrics(0);
      seek.value = 0;
      cur.textContent = '0:00';
      dur.textContent = '0:00';
      if (autoplay) {
        audio.play().catch(() => {});
        playBtn.innerHTML = PAUSE_ICON;
      } else {
        playBtn.innerHTML = PLAY_ICON;
      }
    }

    playBtn.addEventListener('click', () => {
      if (audio.paused) { audio.play(); playBtn.innerHTML = PAUSE_ICON; }
      else { audio.pause(); playBtn.innerHTML = PLAY_ICON; }
    });
    if (prevBtn) prevBtn.addEventListener('click', () => loadTrack(index - 1, true));
    if (nextBtn) nextBtn.addEventListener('click', () => loadTrack(index + 1, true));
    audio.addEventListener('ended', () => loadTrack(index + 1, true));
    audio.addEventListener('loadedmetadata', () => { dur.textContent = fmt(audio.duration); });
    audio.addEventListener('timeupdate', () => {
      cur.textContent = fmt(audio.currentTime);
      syncLyrics(audio.currentTime);
      if (audio.duration) seek.value = (audio.currentTime / audio.duration) * 100;
    });
    seek.addEventListener('input', () => {
      if (audio.duration) audio.currentTime = (seek.value / 100) * audio.duration;
    });

    function setVolume(v) {
      audio.volume = v;
      volSlider.value = Math.round(v * 100);
      if (volIcon) volIcon.innerHTML = v === 0 ? VOL_MUTE_ICON : VOL_ICON;
    }

    if (volSlider) {
      setVolume(parseFloat(volSlider.value) / 100);
      volSlider.addEventListener('input', () => {
        const v = parseFloat(volSlider.value) / 100;
        if (v > 0) lastVolume = v;
        setVolume(v);
      });
    }
    if (volBtn) {
      volBtn.addEventListener('click', () => {
        if (audio.volume > 0) {
          lastVolume = audio.volume;
          setVolume(0);
        } else {
          setVolume(lastVolume || 1);
        }
      });
    }
    lyricsData = parseLRC(tracks[0] && tracks[0].lrc);
    currentLyricIndex = -2;
    renderLyrics(lyricsData);
    syncLyrics(0);
  })();
</script>
</body>
</html>`;
}

export default {
  async fetch(request, env, ctx) {
    const html = renderPage(CONFIG);
    return new Response(html, {
      headers: { "content-type": "text/html;charset=UTF-8" },
    });
  },
};