export function iniciarScanner(callback){

let buffer = ""
let lastTime = Date.now()

document.addEventListener("keydown",(e)=>{

const now = Date.now()

if(now - lastTime > 100){
buffer = ""
}

lastTime = now

if(e.key === "Enter"){

if(buffer.length > 0){
callback(buffer)
}

buffer = ""

}else{

if(e.key.length === 1){
buffer += e.key
}

}

})

}