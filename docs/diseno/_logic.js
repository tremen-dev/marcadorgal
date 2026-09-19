/* Bloque de lóxica compartido a man polos artboards interactivos.
   Non se importa: os artboards non comparten runtime, así que cada un leva a súa copia. */
  data() {
    return [
      ['t3g1','Terceira RFEF G1',4,[
        ['L',"31'",'Bergantiños FC',1,1,'UD Somozas','conf',1],
        ['L',"29'",'CD Barco',0,2,'Polvorín FC','conf',0],
        ['L',"28'",'Arosa SC',0,0,'Silva SD','conf',1],
        ['D','DESC','SD Compostela',2,0,'Ourense CF','conf',0],
        ['F','FIN','Rápido de Bouzas',1,1,'Deportivo Fabril','conf',0],
        ['P','18:30','Coruxo FC',null,null,'UD Ourense','conf',0],
        ['P','19:00','Racing Villalbés',null,null,'Estradense','conf',0]
      ]],
      ['pf1','Preferente Futgal G1',4,[
        ['L',"67'",'Alondras CF',2,1,'Céltiga FC','conf',1],
        ['L',"72'",'Villalonga FC',1,0,'CD Ribadumia','prov',0],
        ['D','DESC','Choco SD',0,0,'As Pontes CF','conf',0],
        ['S',"55'",'Atlético Arnoia',0,0,'CD Barbadás','conf',0],
        ['F','FIN','Fisterra CF',3,1,'CD Beluso','conf',0],
        ['F','FIN','Sofán CF',2,2,'Órdenes SC','pend',0],
        ['A','APR','Portonovo SD',null,null,'Boiro FC','conf',0]
      ]],
      ['pf2','Preferente Futgal G2',4,[
        ['L',"64'",'CD Cerceda',2,0,'SD Brigantium','conf',0],
        ['L',"61'",'Noia CF',1,1,'Xallas CF','conf',0],
        ['F','FIN','Betanzos CF',0,3,'Laracha CF','conf',0],
        ['F','FIN','Dubra CF',1,0,'Negreira CF','prov',0],
        ['P','18:00','Muros SD',null,null,'Viveiro CF','conf',0],
        ['P','18:30','Ribadeo FC',null,null,'Alertanavia','conf',0]
      ]],
      ['pf3','Preferente Futgal G3',4,[
        ['L',"58'",'Moaña CF',1,2,'Bueu Atlético','conf',0],
        ['F','FIN','Cambados SC',2,1,'Gran Peña FC','conf',0],
        ['F','FIN','Sárdoma CF',0,0,'Atl. Arousana','conf',0],
        ['P','18:00','Pontellas FC',null,null,'Mos CF','conf',0],
        ['P','19:00','Redondela CF',null,null,'Tomiño CF','conf',0]
      ]],
      ['g1a','Primeira Galega G1',3,[
        ['L',"70'",'Órdenes SC B',0,1,'Sada CF','prov',0],
        ['F','FIN','Arteixo CF',2,0,'Culleredo CF','conf',0],
        ['F','FIN','Ponte dos Brozos',1,1,'Oleiros SD','conf',0],
        ['P','17:30','Carballo CF',null,null,'Cambre CF','conf',0],
        ['P','18:00','Ares CF',null,null,'Mugardos CF','conf',0]
      ]],
      ['g1b','Primeira Galega G2',3,[
        ['L',"66'",'Antas de Ulla',1,0,'Chantada CF','conf',0],
        ['F','FIN','Monforte CF',3,2,'Sarria CF','conf',0],
        ['F','FIN','Burela FC',0,0,'Foz CF','pend',0],
        ['P','17:00','Guitiriz CF',null,null,'Meira CF','conf',0],
        ['P','18:00','Palas CF',null,null,'Bóveda CF','conf',0]
      ]],
      ['g2a','Segunda Galega G1',3,[
        ['F','FIN','Melide CF',2,1,'Arzúa CF','conf',0],
        ['F','FIN','Boimorto CF',0,2,'Curtis CF','conf',0],
        ['P','16:30','Sigüeiro CF',null,null,'Val do Dubra','conf',0],
        ['P','17:00','Teo CF',null,null,'Ames CF','conf',0]
      ]],
      ['g2b','Segunda Galega G2',3,[
        ['L',"52'",'Verín CF',0,0,'Xinzo CF','conf',0],
        ['F','FIN','Celanova CF',1,3,'Allariz CF','conf',0],
        ['P','17:00','Maceda CF',null,null,'Castro Caldelas','conf',0],
        ['A','APR','O Carballiño',null,null,'Ribadavia CF','conf',0]
      ]],
      ['fem','Primeira Galega feminina',3,[
        ['L',"48'",'Victoria CF',2,0,'Sárdoma CF','conf',0],
        ['F','FIN','Orzán SD',1,1,'Friol CF','conf',0],
        ['F','FIN','Sporting Guardés B',3,0,'Racing Feminino','prov',0],
        ['P','17:00','Deportivo ABANCA B',null,null,'Viajes InterRías','conf',0]
      ]],
      ['ea','LALIGA EA Sports',4,[
        ['L',"38'",'RC Celta',1,0,'Rayo Vallecano','conf',1],
        ['F','FIN','Real Betis',2,2,'Girona FC','conf',0],
        ['P','18:30','Villarreal CF',null,null,'Athletic Club','conf',0],
        ['P','21:00','Real Madrid',null,null,'RCD Espanyol','conf',0]
      ]],
      ['hyp','LALIGA Hypermotion',5,[
        ['L',"41'",'RC Deportivo',2,1,'SD Huesca','conf',1],
        ['F','FIN','Racing de Ferrol',0,1,'Real Zaragoza','conf',0],
        ['P','18:00','Albacete BP',null,null,'CD Mirandés','conf',0],
        ['P','20:30','Sporting de Gijón',null,null,'Cádiz CF','conf',0]
      ]],
      ['p1f','Primeira Federación G1',4,[
        ['L',"35'",'SD Ponferradina',0,0,'Real Unión','conf',0],
        ['F','FIN','Pontevedra CF',1,0,'Zamora CF','conf',0],
        ['P','17:00','CD Lugo',null,null,'Barakaldo CF','conf',0],
        ['P','19:00','Cultural Leonesa',null,null,'SD Amorebieta','conf',0]
      ]]
    ];
  }

  strings() {
    return {
      gl: { xornada:'Xornada', global:'Global', tables:'Clasificacións', all:'Todos', live:'Directo',
            fin:'Rematados', d0:'ven 29', d1:'SÁB 30', d2:'dom 31', d3:'lun 01', none:'nada aquí',
            post:'apr', postLong:'aprazado', round:'xornada', search:'Buscar equipo', trace:'Traza',
            log:'Historial de decisións', conf:'confirmado', prov:'provisional',
            pend:'pendente de confirmar', nosig:'sen sinal', pick:'Escolle un partido',
            pickHint:'Toca calquera fila para ver de onde vén o seu marcador.',
            mine:'As miñas ligas', nat:'Nacional', follow:'Equipos seguidos', more:'Máis',
            hint:'Toca unha fila para seguila · toca a competición para pregala',
            noCrawl:'non rastrexable', weight:'peso', rule:'regra', stamp:'sáb 30 · 18:43' },
      es: { xornada:'Jornada', global:'Global', tables:'Clasificaciones', all:'Todos', live:'En directo',
            fin:'Finalizados', d0:'vie 29', d1:'SÁB 30', d2:'dom 31', d3:'lun 01', none:'nada aquí',
            post:'apl', postLong:'aplazado', round:'jornada', search:'Buscar equipo', trace:'Traza',
            log:'Historial de decisiones', conf:'confirmado', prov:'provisional',
            pend:'pendiente de confirmar', nosig:'sin señal', pick:'Elige un partido',
            pickHint:'Toca cualquier fila para ver de dónde viene su marcador.',
            mine:'Mis ligas', nat:'Nacional', follow:'Equipos seguidos', more:'Más',
            hint:'Toca una fila para seguirla · toca la competición para plegarla',
            noCrawl:'no rastreable', weight:'peso', rule:'regla', stamp:'sáb 30 · 18:43' }
    };
  }
