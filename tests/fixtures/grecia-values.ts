/**
 * Fixture: valores de referência para o template Grécia.
 *
 * Derivados diretamente dos componentes React reais em
 * renova-turismo-jornada-main/src/components/campaigns/grecia/
 * (D-13, D-14 — fixture manual per 01-SKELETON.md §Architectural Decisions)
 */

export const greciaValues = {
  // SEO
  seo_titulo: 'Explore a Grécia Eterna — Renova Turismo',
  seo_descricao: 'Uma jornada entre deuses, ilhas e o azul mais profundo do Mediterrâneo. Atenas, Delfos, Meteora, Santorini e Mykonos.',

  // Hero (Hero.tsx)
  hero_subtitulo: 'Renova Turismo apresenta',
  hero_titulo_linha1: 'Explore',
  hero_titulo_linha2: 'a Grécia',
  hero_titulo_linha3: 'Eterna',
  hero_descricao: '<p>Uma jornada entre deuses, ilhas e o azul mais profundo do Mediterrâneo — do esplendor de Atenas à magia das Cíclades.</p>',
  hero_imagem: '/assets/grecia/hero-santorini.jpg',
  cta_primary_label: 'Reservar Agora',
  cta_primary_url: 'https://api.whatsapp.com/send/?phone=5519992016125&text=Ol%C3%A1%21+Tenho+interesse+na+viagem+para+a+Gr%C3%A9cia+e+gostaria+de+receber+mais+informa%C3%A7%C3%B5es.&type=phone_number&app_absent=0',

  // Destaques — repeater (Hero.tsx floatingCards — 3 itens)
  destaques: [
    {
      imagem: '/assets/grecia/egeu.jpg',
      titulo: 'Ilhas Escondidas',
      descricao: '<p>Enseadas de água cristalina e vilarejos preservados que poucos viajantes brasileiros conhecem.</p>',
    },
    {
      imagem: '/assets/grecia/atenas.jpg',
      titulo: 'Cultura Milenar',
      descricao: '<p>Da Acrópole aos oráculos de Delfos — caminhe pelos berços da filosofia, da democracia e da mitologia.</p>',
    },
    {
      imagem: '/assets/grecia/mykonos.jpg',
      titulo: 'Mediterrâneo Vivo',
      descricao: '<p>Pôr do sol em Santorini, moinhos de Mykonos e a culinária grega autêntica em cada parada.</p>',
    },
  ],

  // Sobre a Viagem (SobreViagem.tsx)
  sobre_descricao_1: '<p>A Grécia é o ponto de encontro entre mito e mar. Esta jornada conduz você do mármore eterno do Partenon aos penhascos brancos de Santorini, passando pelo silêncio sagrado de Delfos e pelas torres rochosas de Meteora.</p>',
  sobre_descricao_2: '<p>Pequenos grupos, guias em português e hospedagem cuidadosamente selecionada — uma experiência projetada para quem viaja em busca de beleza, história e contemplação.</p>',

  // Info Cards — repeater (SobreViagem.tsx — 3 itens)
  info_cards: [
    { label: 'Quando', valor: 'Datas sob consulta — 2026 / 2027' },
    { label: 'Destinos', valor: 'Atenas, Delfos, Meteora, Santorini e Mykonos' },
    { label: 'Partida', valor: 'São Paulo — Aeroporto de Guarulhos (GRU)' },
  ],

  // Inclusos — repeater (Inclusos.tsx items — 6 itens)
  inclusos: [
    { titulo: 'Guias Especializados', texto: 'Guias locais falando português, com profundo conhecimento cultural e histórico, para enriquecer cada momento da viagem.' },
    { titulo: 'Refeições Incluídas', texto: 'Café da manhã e jantar todos os dias, para que você se preocupe apenas com a experiência da viagem.' },
    { titulo: 'Voos e Transfers', texto: 'Toda a logística incluída — dos voos internacionais aos transfers entre cidades e hotéis, sem preocupações.' },
    { titulo: 'Hotéis Turística Superior', texto: 'Hospedagem selecionada pelo conforto e localização privilegiada — descanso e praticidade após cada dia.' },
    { titulo: 'Seguro Viagem Completo', texto: 'Cobertura total para que você viaje com a tranquilidade de estar protegido em todos os momentos.' },
    { titulo: 'Assistência 24 Horas', texto: 'Acompanhamento de um profissional da Renova Turismo durante toda a viagem, pronto para atender você.' },
  ],

  // Roteiro — repeater (Roteiro.tsx slides — 7 itens)
  roteiro: [
    {
      imagem: '/assets/grecia/egeu.jpg',
      imagem_alt: 'Vista aérea de enseada grega com mar turquesa',
      regiao: 'São Paulo → Atenas',
      regiao_en: 'Departure',
      dia: '1º — 2º Dia',
      titulo: 'GUARULHOS → ATENAS',
      descricao: '<p>Apresentação no aeroporto internacional de Guarulhos (GRU) para embarque com destino a Atenas. Voos com as devidas conexões. Chegada à capital grega, recepção pelo guia local e traslado ao hotel.</p>',
      destaque: 'O início de uma jornada pelo berço da civilização ocidental.',
    },
    {
      imagem: '/assets/grecia/atenas.jpg',
      imagem_alt: 'Partenon na Acrópole de Atenas ao entardecer',
      regiao: 'Atenas',
      regiao_en: 'Athens',
      dia: '3º Dia',
      titulo: 'ATENAS — CITY TOUR',
      descricao: '<p>Visita à Acrópole e ao Partenon, símbolos máximos da Grécia Antiga. Caminhada pelo bairro histórico de Plaka, Ágora Romana, Templo de Zeus Olímpico e Praça Syntagma. À tarde, tempo livre para explorar os cafés e tavernas locais.</p>',
      destaque: 'Acrópole, Partenon e o coração histórico de Atenas.',
    },
    {
      imagem: '/assets/grecia/delfos.jpg',
      imagem_alt: 'Ruínas de Delfos com colunas e ciprestes',
      regiao: 'Delfos',
      regiao_en: 'Delphi',
      dia: '4º Dia',
      titulo: 'ATENAS → DELFOS',
      descricao: '<p>Saída rumo a Delfos, considerada na Antiguidade o "umbigo do mundo". Visita ao sítio arqueológico, ao Templo de Apolo e ao museu local. Paisagens deslumbrantes do Monte Parnaso ao longo do caminho.</p>',
      destaque: 'O oráculo mais sagrado da Grécia Antiga.',
    },
    {
      imagem: '/assets/grecia/meteora.jpg',
      imagem_alt: 'Mosteiros de Meteora sobre rochas com neblina',
      regiao: 'Meteora',
      regiao_en: 'Meteora',
      dia: '5º Dia',
      titulo: 'DELFOS → METEORA',
      descricao: '<p>Continuação até Kalambaka, base para visitar os impressionantes mosteiros de Meteora — construções ortodoxas suspensas sobre torres rochosas que parecem flutuar no céu. Patrimônio Mundial da UNESCO.</p>',
      destaque: 'Mosteiros suspensos entre o céu e a terra.',
    },
    {
      imagem: '/assets/grecia/hero-santorini.jpg',
      imagem_alt: 'Casas brancas e cúpulas azuis de Santorini',
      regiao: 'Santorini',
      regiao_en: 'Santorini',
      dia: '6º — 7º Dia',
      titulo: 'ATENAS → SANTORINI',
      descricao: '<p>Voo doméstico até Santorini, a ilha mais icônica do Mar Egeu. Dias dedicados às vilas de Oia e Fira, vinícolas locais, praias vulcânicas e ao mundialmente famoso pôr do sol na caldeira.</p>',
      destaque: 'Pôr do sol em Oia — uma das vistas mais belas do mundo.',
    },
    {
      imagem: '/assets/grecia/mykonos.jpg',
      imagem_alt: 'Moinhos de vento de Mykonos ao pôr do sol',
      regiao: 'Mykonos',
      regiao_en: 'Mykonos',
      dia: '8º — 9º Dia',
      titulo: 'SANTORINI → MYKONOS',
      descricao: '<p>Travessia em ferry até Mykonos. Exploração da Chora com seus moinhos, ruelas labirínticas e a Little Venice. Tempo livre para praias e a vibrante gastronomia mediterrânea.</p>',
      destaque: 'Os moinhos brancos e a alma cosmopolita do Egeu.',
    },
    {
      imagem: '/assets/grecia/egeu.jpg',
      imagem_alt: 'Mar Egeu visto do alto, voo de retorno',
      regiao: 'Mykonos → São Paulo',
      regiao_en: 'Return',
      dia: '10º — 11º Dia',
      titulo: 'MYKONOS → ATENAS → SÃO PAULO',
      descricao: '<p>Em horário determinado, traslado ao aeroporto e voo de retorno com conexão em Atenas. Chegada a São Paulo-Guarulhos com memórias de uma vida.</p>',
      destaque: 'Memórias da Grécia eterna para levar pelo resto da vida.',
    },
  ],

  // Diferenciais — repeater (PorQueRenova.tsx reasons — 5 itens)
  diferenciais: [
    { titulo: 'Experiências Únicas', texto: 'Cada roteiro é pensado para proporcionar momentos memoráveis e enriquecedores.' },
    { titulo: 'Guias Especializados', texto: 'Acompanhamento de guias com conhecimento cultural e histórico.' },
    { titulo: 'Segurança Total', texto: 'Cuidamos de cada detalhe para você viajar com tranquilidade.' },
    { titulo: 'Cuidado com o Grupo', texto: 'Independente da sua idade, você poderá desfrutar de todo o roteiro.' },
    { titulo: 'Experiência Comprovada', texto: 'Mais de 20 anos no mercado de viagens em grupo, com excelência reconhecida.' },
  ],

  // Depoimentos — repeater (Depoimentos.tsx testimonials — 3 itens)
  depoimentos: [
    {
      nome: 'Dr. Felipe Silva',
      localidade: 'Campinas/SP',
      quote: '<p>Excelente empresa. Excelente tratamento. Excelentes produtos. Excelente pós-venda. É o tipo de empresa que entende que uma viagem pode significar muito mais do que apenas uma viagem.</p>',
    },
    {
      nome: 'Ilda Costa',
      localidade: 'Itu/SP',
      quote: '<p>Da viagem que fiz só tenho pontos positivos. A equipe da Renova esteve presente nos dando toda assistência. A atenção para com o cliente foi o que me fez ter o desejo de fazer novas viagens com a Renova.</p>',
    },
    {
      nome: 'Luciano Martins',
      localidade: 'São Paulo/SP',
      quote: '<p>Uma empresa responsável, dedicada a proporcionar o máximo de bem estar aos clientes. Estou muito satisfeito com o empenho e organização, que é uma marca registrada desta empresa.</p>',
    },
  ],

  // Inscreva-se / CTA (InscrevaSe.tsx)
  roteiro_subtitulo: '11 dias inesquecíveis: Atenas, Delfos, Meteora, Santorini e Mykonos.',
  cta_roteiro_label: 'Garanta Sua Vaga',
  inscrevase_subtitulo: 'Vagas limitadas',
  inscrevase_titulo_1: 'Garanta seu',
  inscrevase_titulo_2: 'Lugar',
  inscrevase_descricao: '<p>Entre em contato com nossa equipe e dê o primeiro passo rumo à sua jornada pela Grécia. Atendimento personalizado, sem compromisso.</p>',
  inscrevase_cta_label: 'Falar no WhatsApp',
};

export const greciaBrand = {
  whatsapp: 'https://api.whatsapp.com/send/?phone=5519992016125&text=Ol%C3%A1%21+Tenho+interesse+na+viagem+para+a+Gr%C3%A9cia+e+gostaria+de+receber+mais+informa%C3%A7%C3%B5es.&type=phone_number&app_absent=0',
  logo: '/assets/logo-renova.svg',
  instagram: 'https://instagram.com/renovaturismo',
  facebook: 'https://facebook.com/renovaturismo',
  youtube: 'https://youtube.com/@renovaturismo',
  email: 'contato@renovaturismo.com.br',
  phone: '+55 19 3241-2424',
  primary_color: '#0a1628',
};
