import { describe, expect, it } from 'vitest';
import { getDirectRecommendationHref, getReliableRecommendationHref } from './linkUtils';

describe('linkUtils', () => {
  it('normalizes valid direct URL', () => {
    expect(getDirectRecommendationHref({ url: 'store.com/item' })).toBe('https://store.com/item');
    expect(getDirectRecommendationHref({ url: 'https://store.com/item' })).toBe('https://store.com/item');
  });

  it('rejects invalid direct URL', () => {
    expect(getDirectRecommendationHref({ url: 'javascript:alert(1)' })).toBe('');
    expect(getDirectRecommendationHref({ url: 'not a url' })).toBe('');
  });

  it('builds reliable link from domain', () => {
    const href = getReliableRecommendationHref(
      {
        domain: 'example.com',
        productName: 'Sony WH-1000XM5 headphones',
        storeName: 'Example Store',
      },
      'Sony WH-1000XM5 headphones'
    );

    expect(href).toContain('google.com/search?q=');
    expect(decodeURIComponent(href)).toContain('site:example.com');
    expect(decodeURIComponent(href)).toContain('Sony WH-1000XM5 headphones');
  });

  it('builds reliable link from direct URL hostname when domain missing', () => {
    const href = getReliableRecommendationHref(
      {
        url: 'https://shop.domain.tld/item123',
        productName: 'Meta Quest 3',
        storeName: 'Domain Shop',
      },
      'Meta Quest 3'
    );

    expect(decodeURIComponent(href)).toContain('site:shop.domain.tld');
  });

  it('supports many country/product fixtures without malformed URLs', () => {
    const fixtures = [
      ['Sony WH-1000XM5 headphones', 'walmart.com'],
      ['Apple iPhone 15 Pro', 'johnlewis.com'],
      ['Samsung Galaxy S24 Ultra', 'mediamarkt.de'],
      ['Nintendo Switch OLED', 'yodobashi.com'],
      ['PlayStation 5 Slim', 'fnac.com'],
      ['Xbox Series X', 'bestbuy.ca'],
      ['Dyson V15 Detect', 'dyson.com.au'],
      ['Kindle Paperwhite 11th gen', 'amazon.in'],
      ['GoPro Hero 12 Black', 'elcorteingles.es'],
      ['Bose QuietComfort Ultra', 'unieuro.it'],
      ['Logitech MX Master 3S', 'bol.com'],
      ['Dell XPS 13 laptop', 'elgiganten.se'],
      ['MacBook Air M3', 'elkjop.no'],
      ['Razer BlackWidow V4 keyboard', 'x-kom.pl'],
      ['ASUS ROG Zephyrus G14', 'worten.pt'],
      ['Canon EOS R50 camera', 'coolblue.be'],
      ['LG C3 OLED TV 55 inch', 'electronic4you.at'],
      ['Garmin Forerunner 265', 'digitec.ch'],
      ['Meta Quest 3', 'currys.ie'],
      ['Herman Miller Embody chair', 'interior.dk'],
      ['Secretlab Titan Evo 2022', 'secretlab.eu'],
      ['Steelcase Leap v2', 'alza.cz'],
      ['Sihoo Doro C300 chair', 'emag.ro'],
      ['Corsair K70 RGB Pro', 'public.gr'],
      ['Anker 737 power bank', 'hepsiburada.com'],
      ['Google Pixel 8 Pro', 'noon.com'],
      ['OnePlus 12', 'jarir.com'],
      ['Xiaomi 14 Ultra', 'lazada.sg'],
      ['DJI Mini 4 Pro', 'shopee.com.my'],
      ['TP-Link Archer AX73 router', 'takealot.com'],
      ['JBL Charge 5', 'magazineluiza.com.br'],
      ['Nespresso Vertuo Pop', 'liverpool.com.mx'],
      ['Instant Pot Duo 7-in-1', 'mercadolibre.com.ar'],
      ['Philips Airfryer XL', 'falabella.com'],
      ['Brother HL-L2350DW printer', 'alkosto.com'],
      ['TCL 55C745 TV', 'powerbuy.co.th'],
      ['Lenovo ThinkPad X1 Carbon', 'coupang.com'],
      ['Amazfit GTR 4', 'jumia.com.eg'],
      ['HP LaserJet MFP M234dwe', 'electroplanet.ma'],
      ['MSI GeForce RTX 4070 Super', 'pbtech.co.nz'],
    ];

    for (const [product, domain] of fixtures) {
      const href = getReliableRecommendationHref(
        { productName: product, storeName: domain, domain },
        product
      );
      expect(href.startsWith('https://www.google.com/search?q=')).toBe(true);
      const decoded = decodeURIComponent(href);
      expect(decoded).toContain(`site:${domain}`);
      expect(decoded).toContain(product);
      expect(decoded.includes('undefined')).toBe(false);
      expect(decoded.includes('null')).toBe(false);
    }
  });
});
