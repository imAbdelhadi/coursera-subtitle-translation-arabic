async function openBilingual () {
  // Turn on bilingual subtitles
  let tracks = document.getElementsByTagName('track')
  let en
  let ArabicLang
  if (tracks.length) {
    // 1. Traverse the subtitle nodes and find Arabic and English subtitles
    for (let i = 0; i < tracks.length; i++) {
      if (tracks[i].srclang === 'en') {
        en = tracks[i]
      } else if (tracks[i].srclang === 'ar-SA') {
        ArabicLang = tracks[i]
      }
    }
    // 2. If English subtitles exist, turn on
    if (en) {
      en.track.mode = 'showing'
      // 3. Determine whether the Arabic subtitles exist, if they exist, open them directly
      if (ArabicLang) {
        ArabicLang.track.mode = 'showing'
      } else {
        // 4. If it does not exist, turn on translation
         // After Chrome is updated to 74
         // It seems that there is a delay between when track.mode ='showing' is set for the first time and when the cues are loaded?
         // temporarily use sleep to let cues have enough time to load the subtitles to ensure normal work, and solve it later
        await sleep(500)
        let cues = en.track.cues
        // Since the sentence-by-sentence translation requires a large number of translation APIs, the number of requests needs to be reduced
        const cuesTextList = getCuesTextList(cues)
        // Perform translation
        for (let i = 0; i < cuesTextList.length; i++) {
          getTranslation(cuesTextList[i][1], translatedText => {
            // Get the returned text, split according to the line break inserted before
            // Then determine the sequence of the cues text, which is the starting position stored before + the current relative position
            // Add the translated text directly after the English subtitles
            const translatedTextList = translatedText.split('\n\n')
            for (let j = 0; j < translatedTextList.length; j++) {
              cues[cuesTextList[i][0] + j].text += '\n' + translatedTextList[j]
            }
          })
        }
      }
    }
  }
}

function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function getCuesTextList (cues) {
  // Take out all the text content of the subtitles and integrate them into a list
  // Each item is a string of no more than 5000 words, (it seems that the API currently used has a 5000 word limit?)
  // and its starting position in cues
  // The returned data structure is probably [[0, text], [95, text]]
  let cuesTextList = []
  for (let i = 0; i < cues.length; i++) {
    if (cuesTextList.length &&
        cuesTextList[cuesTextList.length - 1][1].length +
        cues[i].text.length < 5000) {
      // Need to insert a delimiter (line feed) to split the translated string later
      // Use two newlines to split, because some video subtitles have their own newlines
      cuesTextList[cuesTextList.length - 1][1] += '\n\n' + cues[i].text
    } else {
      cuesTextList.push([i, cues[i].text])
    }
  }
  return cuesTextList
}

function getTranslation (words, callback) {
  // Translate through the Google Translate API, enter the string to be translated, and return the translated string
  const xhr = new XMLHttpRequest()
  let url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ar&dt=t&q=${encodeURI(words)}`
  xhr.open('GET', url, true)
  xhr.responseType = 'text'
  xhr.onload = function () {
    if (xhr.readyState === xhr.DONE) {
      if (xhr.status === 200 || xhr.status === 304) {
        // The translated text returned is probably
        // [["مرحبا.","hello.",null,null,1],["مرحبا","hello",null,null,1]],null,"en"]
        // such a string
        // Need to splice the result into a complete string
        const translatedList = JSON.parse(xhr.responseText)[0]
        let translatedText = ''
        for (let i = 0; i < translatedList.length; i++) {
          translatedText += translatedList[i][0]
        }
        callback(translatedText)
      }
    }
  }
  xhr.send()
}

// Set up monitoring, if a request is received, execute the function to enable bilingual subtitles
chrome.runtime.onMessage.addListener(
  function (request, sender) {
    openBilingual()
  }
)
