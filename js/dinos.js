// ---------------------------------------------------------------------------
// Tipos de alimentação (selo nos botões e no cartão de informações)
// ---------------------------------------------------------------------------
const DIETS = {
  carnivoro: { label: "Carnívoro", icon: "🍖", hint: "Come carne" },
  herbivoro: { label: "Herbívoro", icon: "🌿", hint: "Come plantas" },
  onivoro: { label: "Onívoro", icon: "🍽️", hint: "Come plantas e animais pequenos" },
};

// ---------------------------------------------------------------------------
// Dinossauros do projeto
// ---------------------------------------------------------------------------
// Os botões da página inicial e do modo câmera são criados a partir desta
// lista. Para adicionar um dinossauro novo:
//   1. coloque o arquivo .glb na pasta IMG/;
//   2. coloque uma miniatura (PNG com fundo transparente, virada para a
//      direita) em IMG/miniaturas/;
//   3. adicione um item abaixo.
//
// "animation" (opcional) é para modelos que já vêm com animações:
//   idle    → animação que fica tocando sem parar (parado, respirando);
//   actions → animações que tocam de vez em quando, uma de cada vez.
// Modelos sem animações recebem um movimento simulado (balanço/olhar em volta).
//
// "info" aparece na página inicial:
//   diet   → "carnivoro", "herbivoro" ou "onivoro";
//   length → comprimento aproximado; weight → peso aproximado;
//   period → época em que viveu; age → há quanto tempo;
//   fact   → uma curiosidade curta (uma frase).
const DINOSAURS = [
  {
    name: "T-Rex",
    model: "IMG/jurassic_world_dominion_t_rexmsfs2024orbx.glb",
    thumb: "IMG/miniaturas/t-rex.png",
    info: {
      diet: "carnivoro",
      length: "12 metros",
      weight: "8 toneladas",
      period: "Cretáceo",
      age: "há 68 milhões de anos",
      fact: "Tinha dentes do tamanho de uma banana!",
    },
  },
  {
    name: "Estegossauro",
    model: "IMG/jurassic_world_dominion_stegomsfs2024orbx.glb",
    thumb: "IMG/miniaturas/estegossauro.png",
    info: {
      diet: "herbivoro",
      length: "9 metros",
      weight: "5 toneladas",
      period: "Jurássico",
      age: "há 150 milhões de anos",
      fact: "Era enorme, mas o cérebro era do tamanho de uma noz!",
    },
  },
  {
    name: "Galimimo",
    model: "IMG/jurassic_world_dominion_gallimimusmsfs2024orbx.glb",
    thumb: "IMG/miniaturas/galimimo.png",
    info: {
      diet: "onivoro",
      length: "6 metros",
      weight: "450 quilos",
      period: "Cretáceo",
      age: "há 70 milhões de anos",
      fact: "Corria muito rápido, parecido com um avestruz!",
    },
  },
  {
    name: "Dilofossauro",
    model: "IMG/jurassic_park_the_game_-_dilophosaurus.glb",
    thumb: "IMG/miniaturas/dilofossauro.png",
    info: {
      diet: "carnivoro",
      length: "7 metros",
      weight: "400 quilos",
      period: "Jurássico",
      age: "há 190 milhões de anos",
      fact: "Tinha duas cristas finas no alto da cabeça.",
    },
    animation: {
      idle: "sk90_idle_dilophosaurusup",
      actions: [
        "sk90_dilophosaurusup_lookaround",
        "sk90_idle_dilophosaurusonlyfrillsshaking",
        "sk90_dilophosauruslow_snarl",
      ],
    },
  },
  {
    name: "Tricerátops",
    model: "IMG/jurassic_park_the_game_-_triceratops.glb",
    thumb: "IMG/miniaturas/triceratops.png",
    info: {
      diet: "herbivoro",
      length: "9 metros",
      weight: "6 toneladas",
      period: "Cretáceo",
      age: "há 68 milhões de anos",
      fact: "Seu nome quer dizer \"cara com três chifres\".",
    },
    animation: {
      idle: "sk92_idle_triceratops",
      actions: [
        "sk92_triceratops_lookleft",
        "sk92_triceratops_lookright",
        "sk92_triceratops_snort",
        "sk92_triceratops_pawground",
        "sk92_triceratops_shouldertwitch",
      ],
    },
  },
];
