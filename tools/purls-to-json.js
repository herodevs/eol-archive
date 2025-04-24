const { writeFileSync, existsSync } = require('fs');
const { join } = require('path');
const { PackageURL } = require('packageurl-js');
// const semverRangeSubset = require('semver/ranges/subset');

var argv = require('minimist')(process.argv.slice(2));

const jsonFile = join(process.cwd(), argv.f || 'nes-package-forkpoint.purls.json');

if (!existsSync(jsonFile)) {
  console.error([
    `~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~`,
    `\tERROR - file ${jsonFile} does not exist`,
    `~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~`,
  ].join('\n')
  )
  return process.exit(1);
}

const getVersionURI = (ecosystem, packageName, version) => {
  switch (ecosystem.toLowerCase()) {
    case ('maven'): {
      return `https://central.sonatype.com/artifact/${packageName}/${version}`;
    }
    case ('npm'): {
      return `https://www.npmjs.com/package/${packageName}/v/${version}`
    }
    case ('cargo'): {
      return `https://crates.io/crates/${packageName}/${version}`
    }
    case ('gem'): {
      return `https://rubygems.org/gems/${packageName}/versions/${version}`
    }
    case ('nuget'): {
      return `https://www.nuget.org/packages/${packageName}/${version}`
    }
    case ('pypi'): {
      return `https://pypi.org/project/${packageName}/${version}`;
    }
    default: {
      return 'https://www.herodevs.com';
    }
  }
}

const convertPurlsToManufacturers = (suffix) => {
  const purls = require(jsonFile).purls;

  const manufacturers = {};
  
  for (let purl of purls) {
  
    const {
      type,
      name,
      namespace,
      version,
      qualifiers,
      subpath
    } = PackageURL.fromString(purl);
  
    const componentName = type === 'npm' 
    ? [
        decodeURIComponent(namespace || ''),
        name
      ].filter(x => x).join('/')
    : name;
  
    manufacturers[type] = manufacturers[type] || {
      manufacturer: type,
      components: {}
    };
  
    manufacturers[type].components[componentName] = {
      lifecycles: []
    }
  
    manufacturers[type].components[componentName].lifecycles.push({
      purl,
      eolField: 'isEol',
      range: version,
      isEol: true,
      isDefault: true,
      supportLevel: "STANDARD_SUPPORT"
    });
  
  }
  
  const resultJson = [];
  for (let value of Object.values(manufacturers)) {
    resultJson.push({
      manufacturer: value.manufacturer,
      components: Object.keys(value.components).map((componentName) => {
        return {
          ...value.components[componentName].lifecycles[componentName],
          name: componentName,
          ecosystem: value.manufacturer,
          aliases: [],
          reference: '',
          lifecycles: value.components[componentName].lifecycles
        }
      })
    })
  }
  
  writeFileSync(join(process.cwd(), `registry-${suffix}.json`), JSON.stringify(resultJson, null, 2), {encoding: 'utf8'});
}

const converPurlsToEOLDate = (suffix) => {
  const purls = require(jsonFile).purls;

  const ecosystems = {};
  
  for (let purl of purls) {
  
    const {
      type,
      name,
      namespace,
      version,
      // qualifiers,
      // subpath
    } = PackageURL.fromString(purl);

    const componentName = type === 'npm' 
      ? [
          decodeURIComponent(namespace || ''),
          name
        ].filter(x => x).join('/')
      : name;

  
    ecosystems[type] = ecosystems[type] || {
      ecosystem: type,
      components: {}
    };
    
    ecosystems[type].components[componentName] = ecosystems[type].components[componentName] || {
      cycles: {}
    }

    ecosystems[type]
      .components[componentName]
      .cycles[version] = {
        purl,
        componentName,
        cycle: version,
        releaseDate: '',
        eol: true,
        latest: '',
        latestReleaseDate: '',
        link: getVersionURI(type, componentName, version),
        lts: false,
        support: '',
        extendedSupport: true
      }
  }

  const resultJson = [];
  for (let value of Object.values(ecosystems)) {
    resultJson.push({
      ecosystem: value.ecosystem,
      components: Object.values(value.components).map((component) => {
        const name = Object.values(component.cycles)[0].componentName;
        return {
          name,
          ecosystem: value.ecosystem,
          cycles: Object.values(component.cycles).map((cycle) => {
            delete cycle.componentName;
            return {
              ...cycle
            }
          })
        }
      })
    })
  }
  
    
  writeFileSync(join(process.cwd(), `registry-${suffix}.json`), JSON.stringify(resultJson, null, 2), { encoding: 'utf8' });
}

switch (argv.o) {
  case ('e'): {
    converPurlsToEOLDate('e')
    return process.exit();
  }
  case ('m'):
  default: {
    convertPurlsToManufacturers('m')
    return process.exit();
  }
}
