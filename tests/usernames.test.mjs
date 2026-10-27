import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizarUsuario, usuarioDesdeNombre, esUsuarioValido, resolverEmpleado} from '../src/lib/usernames.ts';

const staff=[{id:'a',nombre:'Luisa Elena Ejemplo',user_id:'auth-a',activo:true},{id:'b',nombre:'JOSÉ Antonio Ejemplo',user_id:'auth-b',activo:true}];
test('first name is case-insensitive and trims whitespace',()=>{
  for(const value of ['Luisa','LUISA','lUiSa','  luisa  ']) assert.equal(resolverEmpleado(staff,value)?.id,'a');
  assert.equal(usuarioDesdeNombre('  Luisa\tElena  Ejemplo '),'luisa');
});
test('Spanish accents and composed Unicode resolve consistently',()=>{
  assert.equal(normalizarUsuario('JOSÉ'),'jose');
  assert.equal(normalizarUsuario('Jose\u0301'),'jose');
  assert.equal(resolverEmpleado(staff,'José')?.id,'b');
});
test('no partial names, emails or complete names are accepted',()=>{
  for(const value of ['lu','Luisa Elena','luisa@example.com','%','', 'a'.repeat(65)]) {
    assert.equal(resolverEmpleado(staff,value),null);
  }
  assert.equal(esUsuarioValido('ana-maria'),true);
});
test('inactive and not-yet-provisioned employees cannot sign in',()=>{
  assert.equal(resolverEmpleado([{...staff[0],activo:false}],'luisa'),null);
  assert.equal(resolverEmpleado([{...staff[0],user_id:null}],'luisa'),null);
});
test('duplicate first names never choose an arbitrary account',()=>{
  const sameFirst={id:'c',nombre:'LUISA Otra Persona',activo:true,user_id:null};
  assert.equal(resolverEmpleado([...staff,sameFirst],'luisa'),null);
  assert.equal(resolverEmpleado([...staff,{...sameFirst,activo:false}],'luisa')?.id,'a');
});
