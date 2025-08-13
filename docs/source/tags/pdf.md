---
title: PDF
type: tags
order: 302
meta_title: PDF tag for loading PDF documents
meta_description: Label Studio PDF tag for loading PDF documents for machine learning and data science projects.
---

The `Pdf` tag displays a PDF document in the labeling interface. Use this tag to perform document-level annotations, transcription, and summarization.

Use with the following data types: PDF.

{% insertmd includes/tags/pdf.md %}

### Supported control tags

The `<Pdf>` tag is intended for document-level classification tasks and does not support applying annotations to the actual content of the PDF. 

For example, if you want to apply labels for OCR tasks, you will need to convert the PDF into images first. For more information, see [Multi-Page Document Annotation](/templates/multi-page-document-annotation). 

You can use the following control tags:

- [Choices](choices)
- [DateTime](datetime)
- [Number](number)
- [Pairwise](pairwise)
- [Rating](rating)
- [Taxonomy](taxonomy)
- [TextArea](textarea)

!!! error Enterprise
    You can also use the PDF tag with [Prompts](https://docs.humansignal.com/guide/prompts_overview) to perform auto-labeling work such as PDF summarization, classification, information extraction, and document intelligence. 

### Example

Labeling configuration to label PDF documents:

```html
<View>
  <Pdf name="pdf" value="$pdf" />
  <Choices name="choices" toName="pdf">
    <Choice value="Legal" />
    <Choice value="Financial" />
    <Choice value="Technical" />
  </Choices>
</View>
```

**Example Input data:**

```json
{
  "pdf": "https://app.humansignal.com/static/samples/sample.pdf"
}
```

