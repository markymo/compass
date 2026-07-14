# UI Iconography Guidelines

To ensure consistency across the platform (including the home page and PDF exports), the following semantic icons from `lucide-react` should be used to represent entity types:

- **Client (Corporate, Partnership, Trust):** `Factory` (matches the factory icon from lucide-react used across dashboards).
- **Client Legal Entity (LE):** `Landmark` (represents an official, registered entity).
- **Supplier (Bank / FI / Service Provider):** `Landmark` (represents a financial institution, matching the Home Page).

## Usage in PDF Exports
When rendering the identity card in the PDF export, follow the home page's design language:
- Client: uses `Factory` (FactoryIcon)
- Client Legal Entity: uses `Landmark` (LandmarkIcon)
- Supplier: uses `Landmark` (LandmarkIcon)
