// Ajoute (une seule fois) les textes du sondage de dates dans les 5 fichiers src/messages/*.json.
// Insertion textuelle en fin de fichier : le reste du fichier n'est pas reformaté.
// Relançable sans risque : si les clés « polls » / « pollEmail » existent déjà, le fichier est laissé tel quel.
//   node scripts/add-poll-messages.cjs

const fs = require('fs')
const path = require('path')

const T = {
  fr: {
    polls: {
      title: 'Sondages', newPoll: '+ Nouveau sondage',
      empty: "Aucun sondage pour l'instant", emptyHint: 'Proposez plusieurs dates et laissez les membres répondre.',
      adminOnly: 'Réservé aux administrateurs du groupe',
      status_open: 'En cours', status_closed: 'Clôturé', status_converted: 'Événement créé',
      answersCount: '{answered} réponse(s) sur {total}',
      formTitle: 'Nouveau sondage', titlePrefix: 'Hors club à',
      fieldClub: 'Club (facultatif)', clubSearchPlaceholder: 'Chercher un club…',
      fieldTitle: 'Question', fieldTitlePlaceholder: 'Hors club à …',
      fieldLocation: 'Lieu', fieldDates: 'Dates proposées', removeDate: 'Retirer cette date', addDate: 'Ajouter une date',
      fieldDescription: 'Message pour les membres (facultatif)', fieldDeadline: 'Répondre avant le (facultatif)',
      notifyNow: 'Prévenir les membres maintenant (email + notification)',
      errNeedTitle: 'Indiquez la question du sondage', errNeedDate: 'Ajoutez au moins une date', errGeneric: 'Une erreur est survenue',
      cancel: 'Annuler', creating: 'Création…', create: 'Créer le sondage',
      deadline: 'Réponse avant le {date}', deadlineShort: "jusqu'au {date}",
      convertedBanner: "Un événement a été créé à partir de ce sondage.", viewEvent: "Voir l'événement",
      closedMsg: 'Ce sondage est clôturé.', convertedMsg: "Une date a été choisie : l'événement est créé.", expiredMsg: 'La date limite de réponse est dépassée.',
      noAnswerYet: 'pas répondu', bestDate: 'Meilleure date', totals: 'Totaux', chooseDate: 'Choisir cette date',
      convertHint: "« Choisir cette date » crée l'événement : les partants sont inscrits, les « peut-être » invités. Vous complétez ensuite les détails.",
      convertConfirm: "Créer l'événement le {date} ? {yes} partant(s) seront inscrits et {maybe} « peut-être » invités.",
      deleteConfirm: 'Supprimer ce sondage et toutes les réponses ?',
      remind: 'Relancer ({count})', reminding: 'Envoi…', reminderSent: 'Relance envoyée à {count} personne(s)',
      close: 'Clôturer', reopen: 'Rouvrir', delete: 'Supprimer',
      invalidTitle: 'Lien invalide', invalidDesc: "Ce lien de sondage n'est pas valide. Utilisez le lien reçu par email ou ouvrez GolfGo.",
      hello: 'Bonjour {name}', intro: 'Pour chaque date, indiquez si vous êtes partant.',
      yes: 'Partant', maybe: 'Peut-être', no: 'Pas dispo', yourAnswer: 'Votre réponse',
      submit: 'Envoyer mes réponses', saving: 'Envoi…', thanks: 'Merci, vos réponses sont enregistrées.',
      changeHint: 'Vous pouvez les modifier tant que le sondage est ouvert.', saveError: "Impossible d'enregistrer. Réessayez dans un instant.",
      openApp: 'Ouvrir GolfGo',
      blockTitle: 'Sondages en cours', answeredEdit: 'Répondu ✓', answerNow: 'Répondre',
    },
    pollEmail: {
      hello: 'Bonjour {name},', subject: 'Sondage : {title}', reminderSubject: 'Rappel – sondage : {title}',
      intro: 'Qui serait partant ? Indiquez en un clic votre disponibilité pour les dates ci-dessous.',
      reminderIntro: "Vous n'avez pas encore répondu à ce sondage. Quelques secondes suffisent.",
      cta: 'Répondre au sondage', deadline: 'Merci de répondre avant le {date}', pushBody: 'Qui est partant ? Répondez en un clic.',
    },
  },
  en: {
    polls: {
      title: 'Polls', newPoll: '+ New poll',
      empty: 'No polls yet', emptyHint: 'Suggest several dates and let members answer.',
      adminOnly: 'Group admins only',
      status_open: 'Open', status_closed: 'Closed', status_converted: 'Event created',
      answersCount: '{answered} of {total} answered',
      formTitle: 'New poll', titlePrefix: 'Away game at',
      fieldClub: 'Club (optional)', clubSearchPlaceholder: 'Search a club…',
      fieldTitle: 'Question', fieldTitlePlaceholder: 'Away game at …',
      fieldLocation: 'Place', fieldDates: 'Proposed dates', removeDate: 'Remove this date', addDate: 'Add a date',
      fieldDescription: 'Message for members (optional)', fieldDeadline: 'Answer before (optional)',
      notifyNow: 'Notify members now (email + notification)',
      errNeedTitle: 'Enter the poll question', errNeedDate: 'Add at least one date', errGeneric: 'Something went wrong',
      cancel: 'Cancel', creating: 'Creating…', create: 'Create poll',
      deadline: 'Answer before {date}', deadlineShort: 'until {date}',
      convertedBanner: 'An event was created from this poll.', viewEvent: 'View event',
      closedMsg: 'This poll is closed.', convertedMsg: 'A date has been chosen: the event is created.', expiredMsg: 'The answer deadline has passed.',
      noAnswerYet: 'no answer', bestDate: 'Best date', totals: 'Totals', chooseDate: 'Choose this date',
      convertHint: '“Choose this date” creates the event: those who are in are registered, “maybe” are invited. You then complete the details.',
      convertConfirm: 'Create the event on {date}? {yes} yes will be registered and {maybe} maybe invited.',
      deleteConfirm: 'Delete this poll and all answers?',
      remind: 'Remind ({count})', reminding: 'Sending…', reminderSent: 'Reminder sent to {count} people',
      close: 'Close', reopen: 'Reopen', delete: 'Delete',
      invalidTitle: 'Invalid link', invalidDesc: 'This poll link is not valid. Use the link from your email or open GolfGo.',
      hello: 'Hello {name}', intro: 'For each date, tell us whether you are in.',
      yes: 'In', maybe: 'Maybe', no: "Can't", yourAnswer: 'Your answer',
      submit: 'Send my answers', saving: 'Sending…', thanks: 'Thank you, your answers are saved.',
      changeHint: 'You can change them while the poll is open.', saveError: 'Could not save. Please try again in a moment.',
      openApp: 'Open GolfGo',
      blockTitle: 'Open polls', answeredEdit: 'Answered ✓', answerNow: 'Answer',
    },
    pollEmail: {
      hello: 'Hello {name},', subject: 'Poll: {title}', reminderSubject: 'Reminder – poll: {title}',
      intro: 'Who is in? Tell us your availability for the dates below in one click.',
      reminderIntro: "You haven't answered this poll yet. It only takes a few seconds.",
      cta: 'Answer the poll', deadline: 'Please answer before {date}', pushBody: 'Who is in? Answer in one click.',
    },
  },
  nl: {
    polls: {
      title: 'Peilingen', newPoll: '+ Nieuwe peiling',
      empty: 'Nog geen peilingen', emptyHint: 'Stel meerdere data voor en laat de leden antwoorden.',
      adminOnly: 'Alleen voor groepsbeheerders',
      status_open: 'Lopend', status_closed: 'Afgesloten', status_converted: 'Evenement aangemaakt',
      answersCount: '{answered} van {total} geantwoord',
      formTitle: 'Nieuwe peiling', titlePrefix: 'Uitwedstrijd bij',
      fieldClub: 'Club (optioneel)', clubSearchPlaceholder: 'Zoek een club…',
      fieldTitle: 'Vraag', fieldTitlePlaceholder: 'Uitwedstrijd bij …',
      fieldLocation: 'Plaats', fieldDates: 'Voorgestelde data', removeDate: 'Deze datum verwijderen', addDate: 'Datum toevoegen',
      fieldDescription: 'Bericht voor de leden (optioneel)', fieldDeadline: 'Antwoorden vóór (optioneel)',
      notifyNow: 'Leden nu verwittigen (e-mail + melding)',
      errNeedTitle: 'Geef de vraag van de peiling in', errNeedDate: 'Voeg minstens één datum toe', errGeneric: 'Er is een fout opgetreden',
      cancel: 'Annuleren', creating: 'Aanmaken…', create: 'Peiling aanmaken',
      deadline: 'Antwoorden vóór {date}', deadlineShort: 'tot {date}',
      convertedBanner: 'Uit deze peiling is een evenement aangemaakt.', viewEvent: 'Evenement bekijken',
      closedMsg: 'Deze peiling is afgesloten.', convertedMsg: 'Er is een datum gekozen: het evenement is aangemaakt.', expiredMsg: 'De uiterste antwoorddatum is verstreken.',
      noAnswerYet: 'geen antwoord', bestDate: 'Beste datum', totals: 'Totalen', chooseDate: 'Deze datum kiezen',
      convertHint: '“Deze datum kiezen” maakt het evenement aan: wie meedoet wordt ingeschreven, “misschien” wordt uitgenodigd. Daarna vult u de details aan.',
      convertConfirm: 'Evenement aanmaken op {date}? {yes} deelnemer(s) worden ingeschreven en {maybe} “misschien” uitgenodigd.',
      deleteConfirm: 'Deze peiling en alle antwoorden verwijderen?',
      remind: 'Herinneren ({count})', reminding: 'Verzenden…', reminderSent: 'Herinnering verstuurd naar {count} persoon/personen',
      close: 'Afsluiten', reopen: 'Heropenen', delete: 'Verwijderen',
      invalidTitle: 'Ongeldige link', invalidDesc: 'Deze peilinglink is niet geldig. Gebruik de link uit uw e-mail of open GolfGo.',
      hello: 'Hallo {name}', intro: 'Geef bij elke datum aan of u meedoet.',
      yes: 'Ik doe mee', maybe: 'Misschien', no: 'Niet beschikbaar', yourAnswer: 'Uw antwoord',
      submit: 'Mijn antwoorden versturen', saving: 'Verzenden…', thanks: 'Bedankt, uw antwoorden zijn opgeslagen.',
      changeHint: 'U kunt ze wijzigen zolang de peiling open is.', saveError: 'Opslaan mislukt. Probeer het zo meteen opnieuw.',
      openApp: 'GolfGo openen',
      blockTitle: 'Lopende peilingen', answeredEdit: 'Geantwoord ✓', answerNow: 'Antwoorden',
    },
    pollEmail: {
      hello: 'Hallo {name},', subject: 'Peiling: {title}', reminderSubject: 'Herinnering – peiling: {title}',
      intro: 'Wie doet mee? Geef met één klik uw beschikbaarheid voor de onderstaande data door.',
      reminderIntro: 'U hebt nog niet geantwoord op deze peiling. Het duurt maar enkele seconden.',
      cta: 'Op de peiling antwoorden', deadline: 'Gelieve te antwoorden vóór {date}', pushBody: 'Wie doet mee? Antwoord met één klik.',
    },
  },
  de: {
    polls: {
      title: 'Umfragen', newPoll: '+ Neue Umfrage',
      empty: 'Noch keine Umfragen', emptyHint: 'Schlagen Sie mehrere Termine vor und lassen Sie die Mitglieder antworten.',
      adminOnly: 'Nur für Gruppenadministratoren',
      status_open: 'Läuft', status_closed: 'Beendet', status_converted: 'Veranstaltung erstellt',
      answersCount: '{answered} von {total} haben geantwortet',
      formTitle: 'Neue Umfrage', titlePrefix: 'Auswärtsrunde bei',
      fieldClub: 'Club (optional)', clubSearchPlaceholder: 'Club suchen…',
      fieldTitle: 'Frage', fieldTitlePlaceholder: 'Auswärtsrunde bei …',
      fieldLocation: 'Ort', fieldDates: 'Vorgeschlagene Termine', removeDate: 'Diesen Termin entfernen', addDate: 'Termin hinzufügen',
      fieldDescription: 'Nachricht an die Mitglieder (optional)', fieldDeadline: 'Antwort bis (optional)',
      notifyNow: 'Mitglieder jetzt benachrichtigen (E-Mail + Benachrichtigung)',
      errNeedTitle: 'Geben Sie die Frage der Umfrage ein', errNeedDate: 'Fügen Sie mindestens einen Termin hinzu', errGeneric: 'Ein Fehler ist aufgetreten',
      cancel: 'Abbrechen', creating: 'Wird erstellt…', create: 'Umfrage erstellen',
      deadline: 'Antwort bis {date}', deadlineShort: 'bis {date}',
      convertedBanner: 'Aus dieser Umfrage wurde eine Veranstaltung erstellt.', viewEvent: 'Veranstaltung ansehen',
      closedMsg: 'Diese Umfrage ist beendet.', convertedMsg: 'Ein Termin wurde gewählt: Die Veranstaltung ist erstellt.', expiredMsg: 'Die Antwortfrist ist abgelaufen.',
      noAnswerYet: 'keine Antwort', bestDate: 'Bester Termin', totals: 'Summen', chooseDate: 'Diesen Termin wählen',
      convertHint: '„Diesen Termin wählen“ erstellt die Veranstaltung: Zusagen werden angemeldet, „Vielleicht“ eingeladen. Danach ergänzen Sie die Details.',
      convertConfirm: 'Veranstaltung am {date} erstellen? {yes} Zusage(n) werden angemeldet und {maybe} „Vielleicht“ eingeladen.',
      deleteConfirm: 'Diese Umfrage und alle Antworten löschen?',
      remind: 'Erinnern ({count})', reminding: 'Wird gesendet…', reminderSent: 'Erinnerung an {count} Person(en) gesendet',
      close: 'Beenden', reopen: 'Wieder öffnen', delete: 'Löschen',
      invalidTitle: 'Ungültiger Link', invalidDesc: 'Dieser Umfrage-Link ist ungültig. Verwenden Sie den Link aus Ihrer E-Mail oder öffnen Sie GolfGo.',
      hello: 'Hallo {name}', intro: 'Geben Sie für jeden Termin an, ob Sie dabei sind.',
      yes: 'Dabei', maybe: 'Vielleicht', no: 'Keine Zeit', yourAnswer: 'Ihre Antwort',
      submit: 'Meine Antworten senden', saving: 'Wird gesendet…', thanks: 'Danke, Ihre Antworten sind gespeichert.',
      changeHint: 'Sie können sie ändern, solange die Umfrage läuft.', saveError: 'Speichern nicht möglich. Bitte gleich noch einmal versuchen.',
      openApp: 'GolfGo öffnen',
      blockTitle: 'Laufende Umfragen', answeredEdit: 'Beantwortet ✓', answerNow: 'Antworten',
    },
    pollEmail: {
      hello: 'Hallo {name},', subject: 'Umfrage: {title}', reminderSubject: 'Erinnerung – Umfrage: {title}',
      intro: 'Wer ist dabei? Geben Sie mit einem Klick Ihre Verfügbarkeit für die folgenden Termine an.',
      reminderIntro: 'Sie haben diese Umfrage noch nicht beantwortet. Es dauert nur wenige Sekunden.',
      cta: 'Umfrage beantworten', deadline: 'Bitte antworten Sie bis {date}', pushBody: 'Wer ist dabei? Antworten Sie mit einem Klick.',
    },
  },
  es: {
    polls: {
      title: 'Encuestas', newPoll: '+ Nueva encuesta',
      empty: 'Aún no hay encuestas', emptyHint: 'Proponga varias fechas y deje que los miembros respondan.',
      adminOnly: 'Solo para administradores del grupo',
      status_open: 'En curso', status_closed: 'Cerrada', status_converted: 'Evento creado',
      answersCount: '{answered} de {total} han respondido',
      formTitle: 'Nueva encuesta', titlePrefix: 'Salida a',
      fieldClub: 'Club (opcional)', clubSearchPlaceholder: 'Buscar un club…',
      fieldTitle: 'Pregunta', fieldTitlePlaceholder: 'Salida a …',
      fieldLocation: 'Lugar', fieldDates: 'Fechas propuestas', removeDate: 'Quitar esta fecha', addDate: 'Añadir una fecha',
      fieldDescription: 'Mensaje para los miembros (opcional)', fieldDeadline: 'Responder antes del (opcional)',
      notifyNow: 'Avisar a los miembros ahora (email + notificación)',
      errNeedTitle: 'Indique la pregunta de la encuesta', errNeedDate: 'Añada al menos una fecha', errGeneric: 'Se ha producido un error',
      cancel: 'Cancelar', creating: 'Creando…', create: 'Crear la encuesta',
      deadline: 'Responder antes del {date}', deadlineShort: 'hasta el {date}',
      convertedBanner: 'Se ha creado un evento a partir de esta encuesta.', viewEvent: 'Ver el evento',
      closedMsg: 'Esta encuesta está cerrada.', convertedMsg: 'Se ha elegido una fecha: el evento está creado.', expiredMsg: 'El plazo para responder ha terminado.',
      noAnswerYet: 'sin respuesta', bestDate: 'Mejor fecha', totals: 'Totales', chooseDate: 'Elegir esta fecha',
      convertHint: '«Elegir esta fecha» crea el evento: los que van se inscriben, los «quizás» se invitan. Después completa los detalles.',
      convertConfirm: '¿Crear el evento el {date}? Se inscribirán {yes} participante(s) y se invitará a {maybe} «quizás».',
      deleteConfirm: '¿Eliminar esta encuesta y todas las respuestas?',
      remind: 'Recordar ({count})', reminding: 'Enviando…', reminderSent: 'Recordatorio enviado a {count} persona(s)',
      close: 'Cerrar', reopen: 'Reabrir', delete: 'Eliminar',
      invalidTitle: 'Enlace no válido', invalidDesc: 'Este enlace de encuesta no es válido. Use el enlace de su email o abra GolfGo.',
      hello: 'Hola {name}', intro: 'Para cada fecha, indique si se apunta.',
      yes: 'Me apunto', maybe: 'Quizás', no: 'No puedo', yourAnswer: 'Su respuesta',
      submit: 'Enviar mis respuestas', saving: 'Enviando…', thanks: 'Gracias, sus respuestas se han guardado.',
      changeHint: 'Puede modificarlas mientras la encuesta esté abierta.', saveError: 'No se pudo guardar. Inténtelo de nuevo en un momento.',
      openApp: 'Abrir GolfGo',
      blockTitle: 'Encuestas en curso', answeredEdit: 'Respondida ✓', answerNow: 'Responder',
    },
    pollEmail: {
      hello: 'Hola {name},', subject: 'Encuesta: {title}', reminderSubject: 'Recordatorio – encuesta: {title}',
      intro: '¿Quién se apunta? Indique con un clic su disponibilidad para las fechas siguientes.',
      reminderIntro: 'Todavía no ha respondido a esta encuesta. Solo lleva unos segundos.',
      cta: 'Responder a la encuesta', deadline: 'Por favor, responda antes del {date}', pushBody: '¿Quién se apunta? Responda con un clic.',
    },
  },
}


// ── Révision du 20/11 : question distincte du nom de l'événement, modification, tutoiement en français ──
const REV = {
  fr: {
    polls: {
      emptyHint: 'Propose plusieurs dates et laisse les membres répondre.',
      fieldTitle: "Nom de l'événement", fieldDescription: 'Question posée aux membres',
      defaultQuestion: 'Serais-tu partant(e) pour cet événement ? Indique les dates qui te conviennent.',
      errNeedTitle: "Indique le nom de l'événement", errNeedDate: 'Ajoute au moins une date',
      convertHint: "« Choisir cette date » crée l'événement : les partants sont inscrits, les « peut-être » invités. Tu complètes ensuite les détails.",
      invalidDesc: "Ce lien de sondage n'est pas valide. Utilise le lien reçu par email ou ouvre GolfGo.",
      intro: 'Pour chaque date, indique si tu es partant.', yourAnswer: 'Ta réponse',
      thanks: 'Merci, tes réponses sont enregistrées.', changeHint: 'Tu peux les modifier tant que le sondage est ouvert.',
      saveError: "Impossible d'enregistrer. Réessaie dans un instant.",
      edit: 'Modifier', editTitle: 'Modifier le sondage', saveChanges: 'Enregistrer',
      removedConfirm: '{count} date(s) retirée(s) : les réponses déjà données pour ces dates seront perdues. Continuer ?',
      resendNotify: "Renvoyer l'email et la notification aux membres",
      clubHint: "Le site du club et l'itinéraire sont ajoutés automatiquement au sondage.",
      clubSearchHint: "Tape les premières lettres du nom du club, sans « golf » ni « club ».",
    },
    pollEmail: {
      intro: 'Qui serait partant ? Indique en un clic ta disponibilité pour les dates ci-dessous.',
      reminderIntro: "Tu n'as pas encore répondu à ce sondage. Quelques secondes suffisent.",
    },
  },
  en: { polls: {
    clubSearchHint: "Type the first letters of the club name, without “golf” or “club”.",
    fieldTitle: 'Event name', fieldDescription: 'Question for members',
    defaultQuestion: 'Are you in for this event? Pick the dates that suit you.',
    edit: 'Edit', editTitle: 'Edit poll', saveChanges: 'Save',
    removedConfirm: '{count} date(s) removed: answers already given for them will be lost. Continue?',
    resendNotify: 'Send the email and notification to members again',
    clubHint: 'The club website and directions are added to the poll automatically.',
    errNeedTitle: 'Enter the event name',
  } },
  nl: { polls: {
    clubSearchHint: "Typ de eerste letters van de clubnaam, zonder “golf” of “club”.",
    fieldTitle: 'Naam van het evenement', fieldDescription: 'Vraag aan de leden',
    defaultQuestion: 'Doet u mee aan dit evenement? Kies de data die u schikken.',
    edit: 'Bewerken', editTitle: 'Peiling bewerken', saveChanges: 'Opslaan',
    removedConfirm: '{count} datum(s) verwijderd: de al gegeven antwoorden voor deze data gaan verloren. Doorgaan?',
    resendNotify: 'E-mail en melding opnieuw naar de leden sturen',
    clubHint: 'De website van de club en de route worden automatisch aan de peiling toegevoegd.',
    errNeedTitle: 'Geef de naam van het evenement in',
  } },
  de: { polls: {
    clubSearchHint: "Geben Sie die ersten Buchstaben des Clubnamens ein, ohne „Golf“ und „Club“.",
    fieldTitle: 'Name der Veranstaltung', fieldDescription: 'Frage an die Mitglieder',
    defaultQuestion: 'Sind Sie bei dieser Veranstaltung dabei? Wählen Sie die Termine, die Ihnen passen.',
    edit: 'Bearbeiten', editTitle: 'Umfrage bearbeiten', saveChanges: 'Speichern',
    removedConfirm: '{count} Termin(e) entfernt: bereits gegebene Antworten dazu gehen verloren. Fortfahren?',
    resendNotify: 'E-Mail und Benachrichtigung erneut an die Mitglieder senden',
    clubHint: 'Website und Anfahrt des Clubs werden automatisch zur Umfrage hinzugefügt.',
    errNeedTitle: 'Geben Sie den Namen der Veranstaltung ein',
  } },
  es: { polls: {
    clubSearchHint: "Escriba las primeras letras del nombre del club, sin «golf» ni «club».",
    fieldTitle: 'Nombre del evento', fieldDescription: 'Pregunta a los miembros',
    defaultQuestion: '¿Se apunta a este evento? Indique las fechas que le convienen.',
    edit: 'Modificar', editTitle: 'Modificar la encuesta', saveChanges: 'Guardar',
    removedConfirm: 'Se han quitado {count} fecha(s): se perderán las respuestas ya dadas para ellas. ¿Continuar?',
    resendNotify: 'Volver a enviar el email y la notificación a los miembros',
    clubHint: 'El sitio web y el itinerario del club se añaden automáticamente a la encuesta.',
    errNeedTitle: 'Indique el nombre del evento',
  } },
}
for (const lang of Object.keys(REV)) for (const ns of Object.keys(REV[lang])) Object.assign(T[lang][ns], REV[lang][ns])

const dir = path.join(__dirname, '..', 'src', 'messages')
for (const lang of Object.keys(T)) {
  const file = path.join(dir, `${lang}.json`)
  let raw = fs.readFileSync(file, 'utf8')
  const parsed = JSON.parse(raw)

  // Si une version précédente des blocs existe (ajoutée en fin de fichier par ce script), on la retire pour la remplacer.
  const cut = raw.indexOf(',\n  "polls": {')
  if (parsed.polls || parsed.pollEmail) {
    if (cut === -1) { console.log(`${lang}.json : blocs polls trouvés ailleurs qu'en fin de fichier, rien modifié`); continue }
    raw = raw.slice(0, cut) + '\n}' + (raw.endsWith('\n') ? '\n' : '')
  }
  const base = JSON.parse(raw)

  const block = ['polls', 'pollEmail']
    .map(k => `  ${JSON.stringify(k)}: ${JSON.stringify(T[lang][k], null, 2).replace(/\n/g, '\n  ')}`)
    .join(',\n')
  const end = raw.lastIndexOf('}')
  const before = raw.slice(0, end).replace(/\s+$/, '')
  const out = `${before},\n${block}\n}${raw.slice(end + 1)}`

  const check = JSON.parse(out)                       // sécurité : ne jamais écrire un JSON invalide
  for (const k of Object.keys(base)) if (JSON.stringify(check[k]) !== JSON.stringify(base[k])) throw new Error(`${lang}.json : la clé ${k} aurait été modifiée`)
  if (out === fs.readFileSync(file, 'utf8')) { console.log(`${lang}.json : déjà à jour`); continue }
  fs.writeFileSync(file, out)
  console.log(`${lang}.json : textes du sondage ${parsed.polls ? 'mis à jour' : 'ajoutés'}`)
}
