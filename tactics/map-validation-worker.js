import {validateMap} from './maps.js';
self.onmessage=({data})=>{try{self.postMessage({id:data.id,errors:validateMap(data.map)});}catch(error){self.postMessage({id:data.id,errors:['Validation failed: '+error.message]});}};
