import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute, ParamMap } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
@Component({
selector: 'app-login',
standalone: true,
templateUrl: './login.html',
styleUrls: ['./login.css'],
imports: [FormsModule, CommonModule]
})
export class LoginComponent implements OnInit {
is_error = false;
user = {
usr: "",
pass: ""
};
constructor(
private router: Router,
) { }
ngOnInit() {
}
validarUsuario() {
if (this.user.usr == 'admin' && this.user.pass == '123') {
this.is_error = false;
this.router.navigate(['/home']);
}
else {
this.is_error = true;
}
}
}