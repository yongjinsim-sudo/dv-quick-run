export class DataverseClient {
  constructor(private baseUrl: string) {}

  async get(path: string, token: string) {
    const url = /^https?:\/\//i.test(path) ? path : `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        Prefer: 'odata.include-annotations="OData.Community.Display.V1.FormattedValue"',
        "OData-Version": "4.0",
        "OData-MaxVersion": "4.0"
      }
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Dataverse error ${response.status} for GET ${url}: ${text}`);
    }
    return JSON.parse(text);
  }

  async patch(path: string, token: string, body: unknown, ifMatch: string = "*") {
    const url = /^https?:\/\//i.test(path) ? path : `${this.baseUrl}${path}`;

    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        "If-Match": ifMatch,
        "OData-Version": "4.0",
        "OData-MaxVersion": "4.0"
      },
      body: JSON.stringify(body)
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(`Dataverse error ${response.status} for PATCH ${url}: ${text}`);
    }

    // PATCH often returns 204 No Content
    if (!text) {
      return { status: response.status };
    }

    try {
      return JSON.parse(text);
    } catch {
      return { status: response.status, raw: text };
    }
  }
}