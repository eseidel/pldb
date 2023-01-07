import { imemo, linkManyAftertext } from "./utils"
import { cleanAndRightShift, getIndefiniteArticle } from "./utils"
import { FeatureSummary } from "./Interfaces"
const lodash = require("lodash")

class FeaturePageTemplate {
  constructor(feature: Feature) {
    this.feature = feature
  }

  feature: Feature

  toScroll() {
    const { feature } = this
    const { title, id, fileName } = feature

    return `import header.scroll

title ${title}

title ${title} - language feature
 hidden

html
 <a class="prevLang" href="${this.prevPage}">&lt;</a>
 <a class="nextLang" href="${this.nextPage}">&gt;</a>

viewSourceUrl ${this.sourceUrl}

startColumns 4

${this.exampleSection}

endColumns

keyboardNav ${this.prevPage} ${this.nextPage}

import ../footer.scroll
`.replace(/\n\n\n+/g, "\n\n")
  }

  makeATag(id) {
    const file = this.feature.base.getFile(id)
    return `<a href="${file.permalink}">${file.title}</a>`
  }

  get facts() {
    const { feature } = this
    const { title, references } = feature

    const facts = []

    if (references.length)
      facts.push(
        `Read more about ${title} on the web: ${linkManyAftertext(references)}`
      )

    facts.push(
      `HTML of this page generated by <a href="https://github.com/breck7/pldb/blob/main/code/Features.ts">Features.ts</a>`
    )
    return facts
  }

  get prevPage() {
    return this.feature.previous.permalink
  }

  get nextPage() {
    return this.feature.next.permalink
  }

  get sourceUrl() {
    return `https://github.com/breck7/pldb/blob/main/database/grammar/${this.feature.id}.grammar`
  }

  get exampleSection() {
    const { feature } = this
    const { title, featurePath } = feature

    const positives = feature.languagesWithThisFeature
    const positiveText = `* Languages *with* ${title} include ${positives
      .map(file => `<a href="../languages/${file.permalink}">${file.title}</a>`)
      .join(", ")}`

    const negatives = feature.languagesWithoutThisFeature
    const negativeText = negatives.length
      ? `* Languages *without* ${title} include ${negatives
          .map(
            file => `<a href="../languages/${file.permalink}">${file.title}</a>`
          )
          .join(", ")}`
      : ""

    const examples = positives
      .filter(file => file.getNode(featurePath).length)
      .map(file => {
        return {
          id: file.id,
          title: file.title,
          example: file.getNode(featurePath).childrenToString()
        }
      })
    const grouped = lodash.groupBy(examples, "example")
    const examplesText = Object.values(grouped)
      .map((group: any) => {
        const id = feature.id
        const links = group
          .map(hit => `<a href="../languages/${hit.id}.html">${hit.title}</a>`)
          .join(", ")
        return `codeWithHeader Example from ${links}:
 ${cleanAndRightShift(lodash.escape(group[0].example), 1)}`
      })
      .join("\n\n")

    return [examplesText, positiveText, negativeText].join("\n\n")
  }
}

class Feature {
  constructor(node: any, collection: FeaturesCollection) {
    this.node = node
    this.collection = collection
    this.fileName = this.id + ".grammar"
  }

  fileName: string

  get permalink() {
    return this.id + ".html"
  }

  @imemo
  get id() {
    return this.node.id.replace("Node", "")
  }

  previous: Feature
  next: Feature

  node: any
  collection: FeaturesCollection

  get yes() {
    return this.languagesWithThisFeature.length
  }

  get no() {
    return this.languagesWithoutThisFeature.length
  }

  get percentage() {
    const { yes, no } = this
    const measurements = yes + no
    return measurements < 100
      ? "-"
      : lodash.round((100 * yes) / measurements, 0) + "%"
  }

  @imemo
  get aka() {
    return this.get("aka") // .join(" or "),
  }

  @imemo
  get token() {
    return this.get("tokenKeyword")
  }

  @imemo
  get titleLink() {
    return `../features/${this.permalink}`
  }

  @imemo
  get _getLanguagesWithThisFeatureResearched() {
    const { id } = this
    return this.base.topLanguages.filter(file =>
      file.getNode("features")?.has(id)
    )
  }

  get(word: string): string {
    return this.node.getFrom(`string ${word}`)
  }

  @imemo
  get title() {
    return this.get("title") || this.id
  }

  @imemo
  get pseudoExample() {
    return (this.get("pseudoExample") || "")
      .replace(/\</g, "&lt;")
      .replace(/\|/g, "&#124;")
  }

  @imemo
  get references() {
    return [this.get("reference")] // todo
  }

  @imemo
  get featurePath() {
    return `features ${this.id}`
  }

  get base() {
    return this.collection.base
  }

  @imemo
  get languagesWithThisFeature() {
    const { featurePath } = this
    return this._getLanguagesWithThisFeatureResearched.filter(
      file => file.get(featurePath) === "true"
    )
  }

  @imemo
  get languagesWithoutThisFeature() {
    const { featurePath } = this
    return this._getLanguagesWithThisFeatureResearched.filter(
      file => file.get(featurePath) === "false"
    )
  }

  @imemo get summary(): FeatureSummary {
    const {
      id,
      title,
      fileName,
      titleLink,
      aka,
      token,
      yes,
      no,
      percentage,
      pseudoExample
    } = this
    return {
      id,
      title,
      fileName,
      titleLink,
      aka,
      token,
      yes,
      no,
      percentage,
      pseudoExample
    }
  }
}

class FeaturesCollection {
  base: any
  features: Feature[]
  constructor(base: any) {
    this.base = base

    const allGrammarNodes = Object.values(
      base
        .nodeAt(0)
        .parsed.getDefinition()
        ._getProgramNodeTypeDefinitionCache()
    )

    this.features = allGrammarNodes
      .filter((node: any) => node.get("extends") === "abstractFeatureNode")
      .map(nodeDef => {
        const feature = new Feature(nodeDef, this)
        if (!feature.title) {
          throw new Error(`Feature ${nodeDef.toString()} has no title.`)
        }
        return feature
      })

    let previous = this.features[this.features.length - 1]
    this.features.forEach((feature: Feature, index: number) => {
      feature.previous = previous
      feature.next = this.features[index + 1]
      previous = feature
    })
    this.features[this.features.length - 1].next = this.features[0]
  }
}

export { FeaturesCollection, FeaturePageTemplate }
