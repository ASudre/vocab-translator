# Thematic category taxonomy

Pick the single best-fit category for each word from this fixed list, so results stay
consistent across independently-processed batches. Do not invent new category names.

Existing categories (already used in the app's public/a1.json):
Acciónes, Adjetivos, Adverbios, Aficiones, Animales, Cabeza, Casa, Clima, Colores, Comida,
Comidas, Cuerpo, Días, Emociones, Escuela, Espacios, Familia, Frutas, Higiene, Hora,
Información, Ingredientes, Movimiento, Muebles, Nacionalidad, Naturaleza, Números, Pronombres,
Ropa, Rutinas, Salud, Saludos, Trabajos, Vehículos, Viajes

Additional categories for more abstract A2-C1 vocabulary (use these when a word doesn't fit
the concrete/beginner categories above):
Economía, Sociedad, Política, Tecnología, Comunicación, Pensamiento, Relaciones, Medio ambiente,
Derecho, Ciencia, Arte y cultura, Deporte, Cantidad y medida, Personalidad, Historia, Religión,
Geografía, Construcción, Herramientas, Música, Literatura, Conflicto, Salud mental, Cambio,
Percepción

If a word is a common grammatical/functional word (conjunction, generic verb like "hacer" or
"tener" with no clear single theme, generic adjective like "bueno") that doesn't fit any theme
well, use an empty string "" rather than forcing a bad fit — this is precedented in the existing
data (456 of 1046 A1 entries already have category "").
